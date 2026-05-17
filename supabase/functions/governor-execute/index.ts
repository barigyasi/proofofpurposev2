// governor-execute
// Admin-only: after a Governor proposal reaches Succeeded state, call execute(...) which
// invokes BountyManagerV2.createBounty(...) on-chain. Parses the BountyCreated event and
// writes the on_chain_bounty_id back to the draft + creates a matching bounties row so
// champions can sign up.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  createPublicClient,
  createWalletClient,
  http,
  encodeFunctionData,
  parseEventLogs,
  parseUnits,
  keccak256,
  toBytes,
} from "https://esm.sh/viem@2.21.45";
import { privateKeyToAccount } from "https://esm.sh/viem@2.21.45/accounts";
import { base } from "https://esm.sh/viem@2.21.45/chains";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const rpc = Deno.env.get("CHAIN_RPC") ?? "https://mainnet.base.org";
const publicClient = createPublicClient({ chain: base, transport: http(rpc) });

const GOVERNOR = "0x137CDAE27838Ddb13572dDDf6bb13E982D968E97" as const;
const BOUNTY_MANAGER_V2 = (Deno.env.get("BOUNTY_MANAGER_V2_ADDRESS") ??
  "0x19cabb84B1A05D89f5F43D6f589b31dbAfd0F352") as `0x${string}`;

const governorAbi = [
  {
    type: "function",
    name: "state",
    stateMutability: "view",
    inputs: [{ name: "proposalId", type: "uint256" }],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    type: "function",
    name: "execute",
    stateMutability: "payable",
    inputs: [
      { name: "targets", type: "address[]" },
      { name: "values", type: "uint256[]" },
      { name: "calldatas", type: "bytes[]" },
      { name: "descriptionHash", type: "bytes32" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

const bountyManagerAbi = [
  {
    type: "function",
    name: "createBounty",
    stateMutability: "nonpayable",
    inputs: [
      { name: "_rewardAmount", type: "uint256" },
      { name: "minParticipants", type: "uint32" },
    ],
    outputs: [{ name: "id", type: "uint256" }],
  },
  {
    type: "event",
    name: "BountyCreated",
    inputs: [
      { name: "id", type: "uint256", indexed: true },
      { name: "rewardAmount", type: "uint256", indexed: false },
      { name: "minParticipants", type: "uint32", indexed: false },
    ],
  },
] as const;

function bountyProposalDescription(draftId: string, name: string): string {
  return `BOUNTY:${draftId}:${name}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { draft_id } = await req.json();
    if (typeof draft_id !== "string") return json({ error: "draft_id required" }, 400);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Auth required" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: userErr,
    } = await userClient.auth.getUser();
    if (userErr || !user) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) return json({ error: "Forbidden" }, 403);

    const { data: draft, error: draftErr } = await supabase
      .from("bounty_drafts")
      .select(
        "id, name, description, reward_purpose, max_participants, dao_proposal_id, on_chain_bounty_id, status, image_url, location, expires_at",
      )
      .eq("id", draft_id)
      .single();
    if (draftErr || !draft) return json({ error: "Draft not found" }, 404);
    if (!draft.dao_proposal_id) return json({ error: "Draft has no on-chain proposal" }, 400);
    if (draft.on_chain_bounty_id) return json({ error: "Already executed", onChainBountyId: draft.on_chain_bounty_id }, 409);

    // Check proposal state.
    const state = (await publicClient.readContract({
      address: GOVERNOR,
      abi: governorAbi,
      functionName: "state",
      args: [BigInt(draft.dao_proposal_id)],
    })) as number;
    if (state !== 4) {
      const labels = ["pending", "active", "canceled", "defeated", "succeeded", "queued", "expired", "executed"];
      return json({ error: `Proposal not Succeeded (state=${labels[state] ?? state})` }, 400);
    }

    const pk = Deno.env.get("BOUNTY_ADMIN_PRIVATE_KEY");
    if (!pk) return json({ error: "Backend signer not configured" }, 500);
    const account = privateKeyToAccount(
      (pk.startsWith("0x") ? pk : `0x${pk}`) as `0x${string}`,
    );
    const walletClient = createWalletClient({ account, chain: base, transport: http(rpc) });

    const rewardWei = parseUnits(String(draft.reward_purpose ?? 0), 18);
    const minParticipants = Math.max(1, Math.min(0xffffffff, Number(draft.max_participants ?? 1)));
    const calldata = encodeFunctionData({
      abi: bountyManagerAbi,
      functionName: "createBounty",
      args: [rewardWei, minParticipants],
    });
    const description = bountyProposalDescription(draft.id, draft.name);
    const descriptionHash = keccak256(toBytes(description));

    const hash = await walletClient.writeContract({
      address: GOVERNOR,
      abi: governorAbi,
      functionName: "execute",
      args: [[BOUNTY_MANAGER_V2], [0n], [calldata], descriptionHash],
      value: 0n,
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") return json({ error: "Execute reverted", txHash: hash }, 500);

    // Parse BountyCreated event from BountyManagerV2 logs.
    const logs = parseEventLogs({
      abi: bountyManagerAbi,
      eventName: "BountyCreated",
      logs: receipt.logs.filter((l) => l.address.toLowerCase() === BOUNTY_MANAGER_V2.toLowerCase()),
    });
    const onChainId = logs[0]?.args?.id as bigint | undefined;
    if (!onChainId) return json({ error: "BountyCreated event missing", txHash: hash }, 500);

    // Update draft + create matching bounty row champions will see.
    const onChainIdNum = Number(onChainId);
    await supabase
      .from("bounty_drafts")
      .update({
        on_chain_bounty_id: onChainIdNum,
        on_chain_tx_hash: hash,
        executed_at: new Date().toISOString(),
        executed_by: user.id,
        status: "executed",
      })
      .eq("id", draft.id);

    const { error: bErr } = await supabase.from("bounties").insert({
      title: draft.name,
      description: draft.description,
      reward_amount: Number(draft.reward_purpose ?? 0),
      max_participants: minParticipants > 0 ? minParticipants : null,
      min_participants: 1,
      image_url: draft.image_url,
      location: draft.location,
      expires_at: draft.expires_at,
      status: "open",
      on_chain_id: onChainIdNum,
      on_chain_tx_hash: hash,
      created_by: user.id,
    });
    if (bErr) console.warn("bounty row insert failed", bErr);

    return json({ ok: true, onChainBountyId: onChainIdNum, txHash: hash });
  } catch (e) {
    console.error("governor-execute error", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

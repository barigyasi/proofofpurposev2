// governor-propose
// Admin-only: takes a bounty draft, encodes BountyManagerV2.createBounty(...) calldata,
// and calls POPGovernor.propose(...) from the backend admin signer.
// Stores the returned proposalId on bounty_drafts.dao_proposal_id.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  createPublicClient,
  createWalletClient,
  http,
  encodeFunctionData,
  parseEventLogs,
  parseUnits,
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
    name: "propose",
    stateMutability: "nonpayable",
    inputs: [
      { name: "targets", type: "address[]" },
      { name: "values", type: "uint256[]" },
      { name: "calldatas", type: "bytes[]" },
      { name: "description", type: "string" },
    ],
    outputs: [{ name: "proposalId", type: "uint256" }],
  },
  {
    type: "event",
    name: "ProposalCreated",
    inputs: [
      { name: "proposalId", type: "uint256", indexed: false },
      { name: "proposer", type: "address", indexed: false },
      { name: "targets", type: "address[]", indexed: false },
      { name: "values", type: "uint256[]", indexed: false },
      { name: "signatures", type: "string[]", indexed: false },
      { name: "calldatas", type: "bytes[]", indexed: false },
      { name: "startBlock", type: "uint256", indexed: false },
      { name: "endBlock", type: "uint256", indexed: false },
      { name: "description", type: "string", indexed: false },
    ],
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

    // Load draft.
    const { data: draft, error: draftErr } = await supabase
      .from("bounty_drafts")
      .select("id, name, reward_purpose, max_participants, dao_proposal_id, status")
      .eq("id", draft_id)
      .single();
    if (draftErr || !draft) return json({ error: "Draft not found" }, 404);
    if (draft.dao_proposal_id)
      return json({ error: "Draft already has a proposal", proposalId: draft.dao_proposal_id }, 409);

    const pk = Deno.env.get("BOUNTY_ADMIN_PRIVATE_KEY");
    if (!pk) return json({ error: "Backend signer not configured" }, 500);
    const account = privateKeyToAccount(
      (pk.startsWith("0x") ? pk : `0x${pk}`) as `0x${string}`,
    );
    const walletClient = createWalletClient({ account, chain: base, transport: http(rpc) });

    // PURPOSE is 18 decimals. reward_purpose is stored as whole units.
    const rewardWei = parseUnits(String(draft.reward_purpose ?? 0), 18);
    const minParticipants = Math.max(1, Math.min(0xffffffff, Number(draft.max_participants ?? 1)));

    const calldata = encodeFunctionData({
      abi: bountyManagerAbi,
      functionName: "createBounty",
      args: [rewardWei, minParticipants],
    });

    const description = bountyProposalDescription(draft.id, draft.name);

    const hash = await walletClient.writeContract({
      address: GOVERNOR,
      abi: governorAbi,
      functionName: "propose",
      args: [[BOUNTY_MANAGER_V2], [0n], [calldata], description],
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") return json({ error: "Tx reverted", txHash: hash }, 500);

    const logs = parseEventLogs({ abi: governorAbi, eventName: "ProposalCreated", logs: receipt.logs });
    const proposalId = logs[0]?.args?.proposalId as bigint | undefined;
    if (!proposalId) return json({ error: "ProposalCreated event missing", txHash: hash }, 500);

    const proposalIdText = proposalId.toString();

    const { error: updateError } = await supabase
      .from("bounty_drafts")
      .update({
        dao_proposal_id: proposalIdText,
        on_chain_tx_hash: hash,
      })
      .eq("id", draft.id);

    if (updateError) {
      return json({
        error: `Proposal created on-chain but could not be saved: ${updateError.message}`,
        proposalId: proposalIdText,
        txHash: hash,
      }, 500);
    }

    return json({ ok: true, proposalId: proposalIdText, txHash: hash, description });
  } catch (e) {
    console.error("governor-propose error", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

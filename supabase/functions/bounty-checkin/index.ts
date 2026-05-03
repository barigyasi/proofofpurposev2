import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { createPublicClient, createWalletClient, http, parseAbi } from "https://esm.sh/viem@2.21.0";
import { privateKeyToAccount } from "https://esm.sh/viem@2.21.0/accounts";
import { base } from "https://esm.sh/viem@2.21.0/chains";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const BOUNTY_MANAGER = "0x7f54d4c8b2f0e75c8aef7e8efbd4a52a7a9a23b0"; // overridden below
const ABI = parseAbi([
  "function addParticipant(uint256 bountyId, address participant)",
]);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const { bountyId, walletAddress, token } = body as {
      bountyId?: string;
      walletAddress?: string;
      token?: string;
    };
    if (!bountyId || !walletAddress) return json({ error: "Missing bountyId or walletAddress" }, 400);
    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) return json({ error: "Bad wallet" }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    // Authorize: admin role OR matching token
    let authorized = false;
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: userData } = await userClient.auth.getUser();
      if (userData?.user) {
        const { data: roleRow } = await admin
          .from("user_roles")
          .select("role")
          .eq("user_id", userData.user.id)
          .eq("role", "admin")
          .maybeSingle();
        if (roleRow) authorized = true;
      }
    }

    const { data: bounty, error: bErr } = await admin
      .from("bounties")
      .select("id,status,on_chain_id,check_in_token,check_in_token_expires_at")
      .eq("id", bountyId)
      .maybeSingle();
    if (bErr || !bounty) return json({ error: "Bounty not found" }, 404);
    if (bounty.status !== "running") return json({ error: "Bounty not running" }, 400);
    if (bounty.on_chain_id === null || bounty.on_chain_id === undefined)
      return json({ error: "Bounty has no on-chain id" }, 400);

    if (!authorized) {
      if (!token || token !== bounty.check_in_token)
        return json({ error: "Unauthorized" }, 401);
      if (bounty.check_in_token_expires_at && new Date(bounty.check_in_token_expires_at) < new Date())
        return json({ error: "Check-in token expired" }, 401);
      authorized = true;
    }

    const { data: signup, error: sErr } = await admin
      .from("bounty_signups")
      .select("id,status,wallet_address")
      .eq("bounty_id", bountyId)
      .ilike("wallet_address", walletAddress)
      .maybeSingle();
    if (sErr || !signup) return json({ error: "No signup found for this wallet" }, 404);
    if (signup.status === "checked_in" || signup.status === "added")
      return json({ error: "Already checked in" }, 400);

    const pk = Deno.env.get("BOUNTY_ADMIN_PRIVATE_KEY");
    if (!pk) return json({ error: "Server missing BOUNTY_ADMIN_PRIVATE_KEY" }, 500);
    const account = privateKeyToAccount((pk.startsWith("0x") ? pk : `0x${pk}`) as `0x${string}`);

    const bountyManagerAddr = (Deno.env.get("BOUNTY_MANAGER_ADDRESS") ??
      "0x0F2Cf105534657b954169CeD15f3294E19350a51") as `0x${string}`;

    const publicClient = createPublicClient({ chain: base, transport: http() });
    const walletClient = createWalletClient({ chain: base, transport: http(), account });

    const hash = await walletClient.writeContract({
      address: bountyManagerAddr,
      abi: ABI,
      functionName: "addParticipant",
      args: [BigInt(bounty.on_chain_id as number), walletAddress as `0x${string}`],
    });
    await publicClient.waitForTransactionReceipt({ hash });

    await admin
      .from("bounty_signups")
      .update({
        status: "checked_in",
        added_tx_hash: hash,
        added_at: new Date().toISOString(),
        checked_in_at: new Date().toISOString(),
      })
      .eq("id", signup.id);

    return json({ ok: true, txHash: hash });
  } catch (e) {
    console.error("bounty-checkin error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

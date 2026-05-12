// refund-pool-deposit (admin)
// Admin records a USDC deposit into the RefundPool. The actual on-chain
// transfer happens from the admin wallet via the frontend UI; this function
// just appends the ledger row (verified against the tx receipt).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { createPublicClient, http } from "https://esm.sh/viem@2.21.45";
import { base } from "https://esm.sh/viem@2.21.45/chains";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const rpc = (Deno.env.get("CHAIN_RPC") ?? "https://mainnet.base.org");
const publicClient = createPublicClient({ chain: base, transport: http(rpc) });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { txHash, amountUsdc, kind, note } = await req.json();
    if (typeof txHash !== "string" || !/^0x[a-f0-9]{64}$/i.test(txHash)) return json({ error: "txHash required" }, 400);
    if (typeof amountUsdc !== "number" || amountUsdc <= 0) return json({ error: "amountUsdc required" }, 400);
    const k = kind === "withdraw" ? "withdraw" : "deposit";

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Auth required" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: roleRow } = await supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!roleRow) return json({ error: "Forbidden" }, 403);

    // Confirm the tx exists on chain (cheap sanity check).
    const receipt = await publicClient.getTransactionReceipt({ hash: txHash as `0x${string}` });
    if (!receipt || receipt.status !== "success") return json({ error: "Tx not confirmed" }, 400);

    const { data: profile } = await supabase.from("profiles").select("wallet_address").eq("id", user.id).single();

    await supabase.from("refund_pool_ledger").insert({
      kind: k,
      amount_usdc: amountUsdc,
      tx_hash: txHash,
      actor: profile?.wallet_address ?? user.id,
      note: note ?? null,
    });

    return json({ ok: true });
  } catch (e) {
    console.error("refund-pool-deposit error", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

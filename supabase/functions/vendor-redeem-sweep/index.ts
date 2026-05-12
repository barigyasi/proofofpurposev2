// vendor-redeem-sweep (cron)
// After the refund window expires on a Settled charge, burns the held PURPOSE
// by calling VendorRedemptionV2.sweep().

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { createPublicClient, createWalletClient, http } from "https://esm.sh/viem@2.21.45";
import { privateKeyToAccount } from "https://esm.sh/viem@2.21.45/accounts";
import { base } from "https://esm.sh/viem@2.21.45/chains";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const REDEMPTION_ABI = [
  { inputs: [{ name: "chargeId", type: "bytes32" }], name: "sweep",
    outputs: [], stateMutability: "nonpayable", type: "function" },
] as const;

const rpc = (Deno.env.get("CHAIN_RPC") ?? "https://mainnet.base.org");
const VENDOR_REDEMPTION_V2 = (Deno.env.get("VENDOR_REDEMPTION_V2_ADDRESS") ?? "").toLowerCase();
const publicClient = createPublicClient({ chain: base, transport: http(rpc) });

function chargeIdToBytes32(uuid: string): `0x${string}` {
  const hex = uuid.replace(/-/g, "");
  return ("0x" + hex.padStart(64, "0")) as `0x${string}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    if (!VENDOR_REDEMPTION_V2 || !/^0x[a-f0-9]{40}$/.test(VENDOR_REDEMPTION_V2)) {
      return json({ error: "V2 contract not yet configured" }, 503);
    }
    const pk = Deno.env.get("BOUNTY_ADMIN_PRIVATE_KEY");
    if (!pk) return json({ error: "Signer key missing" }, 500);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: rows, error } = await supabase
      .from("vendor_charges").select("*").eq("status", "settled").limit(50);
    if (error) throw error;

    const account = privateKeyToAccount(pk as `0x${string}`);
    const walletClient = createWalletClient({ account, chain: base, transport: http(rpc) });

    const swept: string[] = [];
    const skipped: { id: string; reason: string }[] = [];
    for (const c of rows ?? []) {
      try {
        const refundWindow = c.refund_window_seconds ?? 7 * 24 * 3600;
        const settledMs = new Date(c.settled_at ?? c.captured_at).getTime();
        if (Date.now() < settledMs + refundWindow * 1000) {
          skipped.push({ id: c.id, reason: "window not elapsed" });
          continue;
        }
        const cidBytes32 = chargeIdToBytes32(c.id);
        const txHash = await walletClient.writeContract({
          address: VENDOR_REDEMPTION_V2 as `0x${string}`,
          abi: REDEMPTION_ABI, functionName: "sweep", args: [cidBytes32],
        });
        const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
        if (receipt.status !== "success") {
          skipped.push({ id: c.id, reason: "reverted" });
          continue;
        }
        await supabase.from("vendor_charges").update({
          status: "finalized",
          swept_at: new Date().toISOString(), sweep_tx_hash: txHash,
        }).eq("id", c.id);
        swept.push(c.id);
      } catch (e) {
        skipped.push({ id: c.id, reason: e instanceof Error ? e.message : String(e) });
      }
    }
    return json({ ok: true, swept, skipped });
  } catch (e) {
    console.error("vendor-redeem-sweep error", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

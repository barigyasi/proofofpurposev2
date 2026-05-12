// vendor-redeem-cancel
// Cancels a Locked or (within auth window) Captured charge: returns PURPOSE to
// champion + USDC to treasury via VendorRedemptionV2.cancel().

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { createPublicClient, createWalletClient, http } from "https://esm.sh/viem@2.21.45";
import { privateKeyToAccount } from "https://esm.sh/viem@2.21.45/accounts";
import { base } from "https://esm.sh/viem@2.21.45/chains";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const REDEMPTION_ABI = [
  { inputs: [{ name: "chargeId", type: "bytes32" }], name: "cancel",
    outputs: [], stateMutability: "nonpayable", type: "function" },
] as const;

const rpc = "https://mainnet.base.org";
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

    const { chargeId } = await req.json();
    if (typeof chargeId !== "string") return json({ error: "chargeId required" }, 400);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Auth required" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: charge, error } = await supabase.from("vendor_charges").select("*").eq("id", chargeId).single();
    if (error || !charge) return json({ error: "Charge not found" }, 404);
    if (!["locked", "captured"].includes(charge.status)) {
      return json({ error: `Cannot cancel from ${charge.status}` }, 400);
    }

    // Allow vendor (own row), champion (own row), or admin role.
    const { data: profile } = await supabase.from("profiles").select("wallet_address").eq("id", user.id).single();
    const wallet = profile?.wallet_address?.toLowerCase();
    const { data: roleRow } = await supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    const isAdmin = !!roleRow;
    const isVendor = wallet === charge.vendor_wallet.toLowerCase();
    const isChampion = wallet === charge.champion_wallet.toLowerCase();
    if (!isAdmin && !isVendor && !isChampion) return json({ error: "Forbidden" }, 403);

    const account = privateKeyToAccount(pk as `0x${string}`);
    const walletClient = createWalletClient({ account, chain: base, transport: http(rpc) });
    const cidBytes32 = chargeIdToBytes32(charge.id);

    const txHash = await walletClient.writeContract({
      address: VENDOR_REDEMPTION_V2 as `0x${string}`,
      abi: REDEMPTION_ABI, functionName: "cancel", args: [cidBytes32],
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    if (receipt.status !== "success") {
      return json({ error: "Tx reverted", tx_hash: txHash }, 500);
    }

    await supabase.from("vendor_charges").update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      cancel_tx_hash: txHash,
    }).eq("id", chargeId);

    return json({ ok: true, tx_hash: txHash });
  } catch (e) {
    console.error("vendor-redeem-cancel error", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

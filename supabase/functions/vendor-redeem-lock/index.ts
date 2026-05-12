// vendor-redeem-lock
// Called by the vendor frontend after the champion confirms a charge.
// Verifies the champion's EIP-1271 signature, then calls
// VendorRedemptionV2.lockAndCapture() from the backend signer (POS = immediate fulfillment).
// PURPOSE + USDC are pulled into the escrow contract; auth window starts now.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { createPublicClient, createWalletClient, http, keccak256, toHex } from "https://esm.sh/viem@2.21.45";
import { privateKeyToAccount } from "https://esm.sh/viem@2.21.45/accounts";
import { base } from "https://esm.sh/viem@2.21.45/chains";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const REDEMPTION_ABI = [
  { inputs: [
      { name: "chargeId", type: "bytes32" },
      { name: "vendor", type: "address" },
      { name: "champion", type: "address" },
      { name: "purposeAmount", type: "uint256" },
    ], name: "lockAndCapture", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ name: "amountPurpose", type: "uint256" }], name: "quoteUSDC",
    outputs: [{ name: "", type: "uint256" }], stateMutability: "view", type: "function" },
] as const;

const rpc = (Deno.env.get("CHAIN_RPC") ?? "https://mainnet.base.org");
const VENDOR_REDEMPTION_V2 = (Deno.env.get("VENDOR_REDEMPTION_V2_ADDRESS") ?? "").toLowerCase();
const publicClient = createPublicClient({ chain: base, transport: http(rpc) });

function chargeIdToBytes32(uuid: string): `0x${string}` {
  // Pack the 16-byte UUID into a left-padded bytes32.
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

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: charge, error: loadErr } = await supabase
      .from("vendor_charges").select("*").eq("id", chargeId).single();
    if (loadErr || !charge) return json({ error: "Charge not found" }, 404);
    if (charge.status !== "confirmed") return json({ error: `Bad status: ${charge.status}` }, 400);
    if (!charge.champion_signature) return json({ error: "Missing champion signature" }, 400);
    if (new Date(charge.expires_at).getTime() < Date.now()) {
      await supabase.from("vendor_charges").update({ status: "expired" }).eq("id", chargeId);
      return json({ error: "Charge expired" }, 400);
    }

    const message =
      `pop-charge:${charge.id}:${charge.vendor_wallet.toLowerCase()}:` +
      `${charge.champion_wallet.toLowerCase()}:${charge.purpose_amount_wei}:${charge.nonce}`;
    const sigOk = await publicClient.verifyMessage({
      address: charge.champion_wallet as `0x${string}`,
      message,
      signature: charge.champion_signature as `0x${string}`,
    });
    if (!sigOk) {
      await supabase.from("vendor_charges").update({ status: "failed", error: "Bad signature" }).eq("id", chargeId);
      return json({ error: "Bad signature" }, 400);
    }

    const account = privateKeyToAccount(pk as `0x${string}`);
    const walletClient = createWalletClient({ account, chain: base, transport: http(rpc) });
    const amountWei = BigInt(charge.purpose_amount_wei);
    const cidBytes32 = chargeIdToBytes32(charge.id);

    const usdcQuote = (await publicClient.readContract({
      address: VENDOR_REDEMPTION_V2 as `0x${string}`,
      abi: REDEMPTION_ABI, functionName: "quoteUSDC", args: [amountWei],
    })) as bigint;

    const txHash = await walletClient.writeContract({
      address: VENDOR_REDEMPTION_V2 as `0x${string}`,
      abi: REDEMPTION_ABI, functionName: "lockAndCapture",
      args: [cidBytes32, charge.vendor_wallet as `0x${string}`, charge.champion_wallet as `0x${string}`, amountWei],
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    if (receipt.status !== "success") {
      await supabase.from("vendor_charges")
        .update({ status: "failed", lock_tx_hash: txHash, error: "Tx reverted" })
        .eq("id", chargeId);
      return json({ error: "Tx reverted", tx_hash: txHash }, 500);
    }

    const usdcAmount = Number(usdcQuote) / 1e6;
    const now = new Date().toISOString();
    await supabase.from("vendor_charges").update({
      status: "captured",
      locked_at: now, captured_at: now,
      lock_tx_hash: txHash, capture_tx_hash: txHash,
      usdc_payout: usdcAmount,
    }).eq("id", chargeId);

    return json({ ok: true, tx_hash: txHash, usdc_amount: usdcAmount, status: "captured" });
  } catch (e) {
    console.error("vendor-redeem-lock error", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

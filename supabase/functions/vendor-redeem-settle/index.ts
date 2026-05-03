// Settles a vendor charge on-chain by calling VendorRedemptionV2.redeemFor()
// from the backend signer (BOUNTY_ADMIN_PRIVATE_KEY).
//
// Flow:
//  1. Vendor created `vendor_charges` row (status=pending).
//  2. Champion confirmed it from their app (signed canonical message,
//     wrote signature + status=confirmed via RLS).
//  3. This function: re-verifies sig (EIP-1271 against champion's smart
//     wallet), calls redeemFor(vendor, champion, amount), records tx_hash,
//     marks settled, mirrors into vendor_redemptions.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  createPublicClient,
  createWalletClient,
  http,
} from "https://esm.sh/viem@2.21.45";
import { privateKeyToAccount } from "https://esm.sh/viem@2.21.45/accounts";
import { base } from "https://esm.sh/viem@2.21.45/chains";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const VENDOR_REDEMPTION_V2 = (Deno.env.get("VENDOR_REDEMPTION_V2_ADDRESS") ?? "").toLowerCase();

const REDEMPTION_ABI = [
  {
    inputs: [
      { name: "vendor", type: "address" },
      { name: "champion", type: "address" },
      { name: "amountPurpose", type: "uint256" },
    ],
    name: "redeemFor",
    outputs: [{ name: "usdcPaid", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "amountPurpose", type: "uint256" }],
    name: "quoteUSDC",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

const rpc = "https://mainnet.base.org";
const publicClient = createPublicClient({ chain: base, transport: http(rpc) });

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

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: charge, error: loadErr } = await supabase
      .from("vendor_charges")
      .select("*")
      .eq("id", chargeId)
      .single();
    if (loadErr || !charge) return json({ error: "Charge not found" }, 404);
    if (charge.status !== "confirmed") return json({ error: `Bad status: ${charge.status}` }, 400);
    if (!charge.champion_signature) return json({ error: "Missing champion signature" }, 400);
    if (new Date(charge.expires_at).getTime() < Date.now()) {
      await supabase.from("vendor_charges").update({ status: "expired" }).eq("id", chargeId);
      return json({ error: "Charge expired" }, 400);
    }

    // Re-verify the EIP-1271 signature server-side.
    const message =
      `pop-charge:${charge.id}:${charge.vendor_wallet.toLowerCase()}:` +
      `${charge.champion_wallet.toLowerCase()}:${charge.purpose_amount_wei}:${charge.nonce}`;
    const sigOk = await publicClient.verifyMessage({
      address: charge.champion_wallet as `0x${string}`,
      message,
      signature: charge.champion_signature as `0x${string}`,
    });
    if (!sigOk) {
      await supabase
        .from("vendor_charges")
        .update({ status: "failed", error: "Bad signature" })
        .eq("id", chargeId);
      return json({ error: "Bad signature" }, 400);
    }

    // Submit redeemFor() from backend signer.
    const account = privateKeyToAccount(pk as `0x${string}`);
    const walletClient = createWalletClient({ account, chain: base, transport: http(rpc) });

    const amountWei = BigInt(charge.purpose_amount_wei);
    const usdcQuote = (await publicClient.readContract({
      address: VENDOR_REDEMPTION_V2 as `0x${string}`,
      abi: REDEMPTION_ABI,
      functionName: "quoteUSDC",
      args: [amountWei],
    })) as bigint;

    const txHash = await walletClient.writeContract({
      address: VENDOR_REDEMPTION_V2 as `0x${string}`,
      abi: REDEMPTION_ABI,
      functionName: "redeemFor",
      args: [
        charge.vendor_wallet as `0x${string}`,
        charge.champion_wallet as `0x${string}`,
        amountWei,
      ],
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    if (receipt.status !== "success") {
      await supabase
        .from("vendor_charges")
        .update({ status: "failed", tx_hash: txHash, error: "Tx reverted" })
        .eq("id", chargeId);
      return json({ error: "Tx reverted", tx_hash: txHash }, 500);
    }

    const usdcPayout = Number(usdcQuote) / 1e6;

    await supabase
      .from("vendor_charges")
      .update({
        status: "settled",
        tx_hash: txHash,
        settled_at: new Date().toISOString(),
        usdc_payout: usdcPayout,
      })
      .eq("id", chargeId);

    await supabase.from("vendor_redemptions").insert({
      vendor_wallet: charge.vendor_wallet,
      champion_wallet: charge.champion_wallet,
      purpose_amount_wei: charge.purpose_amount_wei,
      usdc_payout: usdcPayout,
      tx_hash: txHash,
    });

    return json({ ok: true, tx_hash: txHash, usdc_payout: usdcPayout });
  } catch (e) {
    console.error("vendor-redeem-settle error", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

import { supabase } from "@/integrations/supabase/client";

/**
 * Canonical message that champions sign to authorize a vendor charge.
 * Must match the format verified server-side in vendor-redeem-lock.
 */
export function chargeMessage(c: {
  id: string;
  vendor_wallet: string;
  champion_wallet: string;
  purpose_amount_wei: string;
  nonce: string;
}) {
  return `pop-charge:${c.id}:${c.vendor_wallet.toLowerCase()}:${c.champion_wallet.toLowerCase()}:${c.purpose_amount_wei}:${c.nonce}`;
}

/**
 * After the champion signs, kick off the on-chain lock+capture (POS flow).
 * Funds are escrowed in VendorRedemptionV2 until the auth window elapses, then
 * the cron settler pays out USDC to the vendor.
 */
export async function settleCharge(chargeId: string) {
  const { data, error } = await supabase.functions.invoke("vendor-redeem-lock", {
    body: { chargeId },
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data as { ok: true; tx_hash: string; usdc_amount: number; status: string };
}

export async function cancelCharge(chargeId: string) {
  const { data, error } = await supabase.functions.invoke("vendor-redeem-cancel", {
    body: { chargeId },
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data as { ok: true; tx_hash: string };
}

export async function refundCharge(
  chargeId: string,
  source: "vendor" | "pool",
  reason?: string,
) {
  const { data, error } = await supabase.functions.invoke("vendor-redeem-refund", {
    body: { chargeId, source, reason },
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data as { ok: true; tx_hash: string };
}

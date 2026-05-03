import { supabase } from "@/integrations/supabase/client";

/**
 * Canonical message that champions sign to authorize a vendor charge.
 * Must match the format verified server-side in the vendor-redeem-settle
 * edge function — keep these two in sync.
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

export async function settleCharge(chargeId: string) {
  const { data, error } = await supabase.functions.invoke("vendor-redeem-settle", {
    body: { chargeId },
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data as { ok: true; tx_hash: string; usdc_payout: number };
}

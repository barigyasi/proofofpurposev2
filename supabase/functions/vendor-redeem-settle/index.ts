// vendor-redeem-settle (cron-driven)
// Finds Captured charges whose auth window has elapsed and calls
// VendorRedemptionV2.settleWithReceipt() (or settle() if receipt contract not configured).
// USDC pays the vendor; PURPOSE stays in escrow until refund window expires
// (vendor-redeem-sweep). When configured, also mints a soulbound on-chain
// receipt NFT to the champion and records the tokenId on vendor_charges.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { createPublicClient, createWalletClient, http, decodeEventLog, parseAbi } from "https://esm.sh/viem@2.21.45";
import { privateKeyToAccount } from "https://esm.sh/viem@2.21.45/accounts";
import { base } from "https://esm.sh/viem@2.21.45/chains";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const REDEMPTION_ABI = parseAbi([
  "function settle(bytes32 chargeId)",
  "function settleWithReceipt(bytes32 chargeId, string championName, string vendorName)",
  "event ReceiptMintFailed(bytes32 indexed chargeId, string reason)",
]);

const RECEIPT_EVENT_ABI = parseAbi([
  "event ReceiptMinted(bytes32 indexed chargeId, uint256 indexed tokenId, address indexed champion, address vendor, uint256 usdcAmount, uint256 purposeAmount)",
]);

const rpc = "https://mainnet.base.org";
const VENDOR_REDEMPTION_V2 = (Deno.env.get("VENDOR_REDEMPTION_V2_ADDRESS") ?? "").toLowerCase();
const RECEIPT_NFT = (Deno.env.get("RECEIPT_NFT_ADDRESS") ?? "").toLowerCase();
const publicClient = createPublicClient({ chain: base, transport: http(rpc) });

function chargeIdToBytes32(uuid: string): `0x${string}` {
  const hex = uuid.replace(/-/g, "");
  return ("0x" + hex.padStart(64, "0")) as `0x${string}`;
}

async function lookupNames(supabase: any, championWallet: string, vendorWallet: string) {
  const [{ data: champ }, { data: vend }] = await Promise.all([
    supabase.from("profiles").select("display_name,username").ilike("wallet_address", championWallet).maybeSingle(),
    supabase.from("vendors").select("business_name").ilike("wallet_address", vendorWallet).maybeSingle(),
  ]);
  const championName = (champ?.display_name || champ?.username || "Champion").slice(0, 64);
  const vendorName = (vend?.business_name || "Vendor").slice(0, 64);
  return { championName, vendorName };
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

    let body: { chargeId?: string; force?: boolean } = {};
    try { body = await req.json(); } catch { /* empty body for cron */ }

    let query = supabase.from("vendor_charges").select("*").eq("status", "captured");
    if (body.chargeId) query = query.eq("id", body.chargeId);
    const { data: rows, error } = await query.limit(50);
    if (error) throw error;

    const account = privateKeyToAccount(pk as `0x${string}`);
    const walletClient = createWalletClient({ account, chain: base, transport: http(rpc) });
    const useReceipt = /^0x[a-f0-9]{40}$/.test(RECEIPT_NFT);

    const settled: { id: string; tx_hash: string; receipt_token_id?: string }[] = [];
    const skipped: { id: string; reason: string }[] = [];

    for (const c of rows ?? []) {
      try {
        const auth = c.auth_window_seconds ?? 24 * 3600;
        const ready = new Date(c.captured_at).getTime() + auth * 1000 <= Date.now();
        if (!ready && !body.force) {
          skipped.push({ id: c.id, reason: "window not elapsed" });
          continue;
        }
        const cidBytes32 = chargeIdToBytes32(c.id);

        let txHash: `0x${string}`;
        if (useReceipt) {
          const { championName, vendorName } = await lookupNames(supabase, c.champion_wallet, c.vendor_wallet);
          txHash = await walletClient.writeContract({
            address: VENDOR_REDEMPTION_V2 as `0x${string}`,
            abi: REDEMPTION_ABI, functionName: "settleWithReceipt",
            args: [cidBytes32, championName, vendorName],
          });
        } else {
          txHash = await walletClient.writeContract({
            address: VENDOR_REDEMPTION_V2 as `0x${string}`,
            abi: REDEMPTION_ABI, functionName: "settle", args: [cidBytes32],
          });
        }

        const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
        if (receipt.status !== "success") {
          await supabase.from("vendor_charges")
            .update({ error: "Settle tx reverted", tx_hash: txHash }).eq("id", c.id);
          skipped.push({ id: c.id, reason: "reverted" });
          continue;
        }

        // Look for ReceiptMinted log
        let receiptTokenId: string | null = null;
        let receiptError: string | null = null;
        if (useReceipt) {
          for (const log of receipt.logs) {
            if (log.address.toLowerCase() !== RECEIPT_NFT) continue;
            try {
              const decoded = decodeEventLog({ abi: RECEIPT_EVENT_ABI, data: log.data, topics: log.topics });
              if (decoded.eventName === "ReceiptMinted") {
                receiptTokenId = (decoded.args as any).tokenId.toString();
                break;
              }
            } catch { /* not our event */ }
          }
          if (!receiptTokenId) {
            // Check for ReceiptMintFailed on the redemption contract
            for (const log of receipt.logs) {
              if (log.address.toLowerCase() !== VENDOR_REDEMPTION_V2) continue;
              try {
                const decoded = decodeEventLog({ abi: REDEMPTION_ABI, data: log.data, topics: log.topics });
                if (decoded.eventName === "ReceiptMintFailed") {
                  receiptError = (decoded.args as any).reason as string;
                  break;
                }
              } catch { /* skip */ }
            }
          }
        }

        const updatePayload: Record<string, unknown> = {
          status: "settled", settled_at: new Date().toISOString(), tx_hash: txHash,
        };
        if (receiptTokenId) {
          updatePayload.receipt_token_id = Number(receiptTokenId);
          updatePayload.receipt_tx_hash = txHash;
          updatePayload.receipt_minted_at = new Date().toISOString();
        }
        if (receiptError) updatePayload.receipt_error = receiptError;

        await supabase.from("vendor_charges").update(updatePayload).eq("id", c.id);
        await supabase.from("vendor_redemptions").insert({
          vendor_wallet: c.vendor_wallet,
          champion_wallet: c.champion_wallet,
          purpose_amount_wei: c.purpose_amount_wei,
          usdc_payout: c.usdc_payout ?? 0,
          tx_hash: txHash,
        });
        settled.push({ id: c.id, tx_hash: txHash, receipt_token_id: receiptTokenId ?? undefined });
      } catch (e) {
        console.error("settle failed", c.id, e);
        skipped.push({ id: c.id, reason: e instanceof Error ? e.message : String(e) });
      }
    }
    return json({ ok: true, settled, skipped });
  } catch (e) {
    console.error("vendor-redeem-settle error", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

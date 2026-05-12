// receipt-mint-retry (admin-only)
// For settled charges where mintReceipt didn't fire (legacy, mintFailed, or
// receipt contract was added after the fact). Calls ReceiptNFT.mintReceipt
// directly via the backend signer, which must have MINTER_ROLE.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { createPublicClient, createWalletClient, http, parseAbi, decodeEventLog } from "https://esm.sh/viem@2.21.45";
import { privateKeyToAccount } from "https://esm.sh/viem@2.21.45/accounts";
import { base } from "https://esm.sh/viem@2.21.45/chains";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RECEIPT_ABI = parseAbi([
  "function mintReceipt(address champion, address vendor, uint256 usdcAmount, uint256 purposeAmount, bytes32 chargeId, uint64 settledAt, string championName, string vendorName) returns (uint256)",
  "function tokenIdForCharge(bytes32) view returns (uint256)",
  "event ReceiptMinted(bytes32 indexed chargeId, uint256 indexed tokenId, address indexed champion, address vendor, uint256 usdcAmount, uint256 purposeAmount)",
]);

const rpc = (Deno.env.get("CHAIN_RPC") ?? "https://mainnet.base.org");
const RECEIPT_NFT = (Deno.env.get("RECEIPT_NFT_ADDRESS") ?? "").toLowerCase();
const publicClient = createPublicClient({ chain: base, transport: http(rpc) });

function chargeIdToBytes32(uuid: string): `0x${string}` {
  return ("0x" + uuid.replace(/-/g, "").padStart(64, "0")) as `0x${string}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    if (!/^0x[a-f0-9]{40}$/.test(RECEIPT_NFT)) return json({ error: "RECEIPT_NFT not configured" }, 503);
    const pk = Deno.env.get("BOUNTY_ADMIN_PRIVATE_KEY");
    if (!pk) return json({ error: "Signer key missing" }, 500);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Auth: require admin via service-role-bypassing has_role check using the user's JWT.
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) return json({ error: "Unauthorized" }, 401);
    const { data: isAdmin } = await userClient.rpc("has_role", { _user_id: userData.user.id, _role: "admin" });
    if (!isAdmin) return json({ error: "Forbidden" }, 403);

    const { chargeId } = (await req.json().catch(() => ({}))) as { chargeId?: string };
    if (!chargeId) return json({ error: "chargeId required" }, 400);

    const { data: c, error } = await supabase
      .from("vendor_charges")
      .select("*").eq("id", chargeId).maybeSingle();
    if (error) throw error;
    if (!c) return json({ error: "charge not found" }, 404);
    if (c.status !== "settled") return json({ error: `charge not settled (${c.status})` }, 400);
    if (c.receipt_token_id) return json({ ok: true, receipt_token_id: c.receipt_token_id, note: "already minted" });

    const cidBytes32 = chargeIdToBytes32(c.id);
    const existing = await publicClient.readContract({
      address: RECEIPT_NFT as `0x${string}`, abi: RECEIPT_ABI,
      functionName: "tokenIdForCharge", args: [cidBytes32],
    });
    if (existing && existing > 0n) {
      await supabase.from("vendor_charges").update({
        receipt_token_id: Number(existing), receipt_minted_at: new Date().toISOString(), receipt_error: null,
      }).eq("id", c.id);
      return json({ ok: true, receipt_token_id: Number(existing), note: "already on chain" });
    }

    const [{ data: champ }, { data: vend }] = await Promise.all([
      supabase.from("profiles").select("display_name,username").ilike("wallet_address", c.champion_wallet).maybeSingle(),
      supabase.from("vendors").select("business_name").ilike("wallet_address", c.vendor_wallet).maybeSingle(),
    ]);
    const championName = (champ?.display_name || champ?.username || "Champion").slice(0, 64);
    const vendorName = (vend?.business_name || "Vendor").slice(0, 64);

    const account = privateKeyToAccount(pk as `0x${string}`);
    const walletClient = createWalletClient({ account, chain: base, transport: http(rpc) });

    const usdc6 = BigInt(Math.round(Number(c.usdc_payout ?? 0) * 1e6));
    const settledAt = BigInt(Math.floor(new Date(c.settled_at ?? c.created_at).getTime() / 1000));

    const tx = await walletClient.writeContract({
      address: RECEIPT_NFT as `0x${string}`, abi: RECEIPT_ABI, functionName: "mintReceipt",
      args: [
        c.champion_wallet as `0x${string}`,
        c.vendor_wallet as `0x${string}`,
        usdc6,
        BigInt(c.purpose_amount_wei),
        cidBytes32,
        settledAt,
        championName,
        vendorName,
      ],
    });
    const rcpt = await publicClient.waitForTransactionReceipt({ hash: tx });
    if (rcpt.status !== "success") return json({ error: "mint reverted", tx }, 500);

    let tokenId: string | null = null;
    for (const log of rcpt.logs) {
      if (log.address.toLowerCase() !== RECEIPT_NFT) continue;
      try {
        const dec = decodeEventLog({ abi: RECEIPT_ABI, data: log.data, topics: log.topics });
        if (dec.eventName === "ReceiptMinted") { tokenId = (dec.args as any).tokenId.toString(); break; }
      } catch {}
    }
    await supabase.from("vendor_charges").update({
      receipt_token_id: tokenId ? Number(tokenId) : null,
      receipt_tx_hash: tx,
      receipt_minted_at: new Date().toISOString(),
      receipt_error: null,
    }).eq("id", c.id);

    return json({ ok: true, receipt_token_id: tokenId, tx });
  } catch (e) {
    console.error("receipt-mint-retry error", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

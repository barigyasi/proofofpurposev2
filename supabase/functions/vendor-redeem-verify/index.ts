import { createPublicClient, http, verifyMessage } from "https://esm.sh/viem@2.21.45";
import { base } from "https://esm.sh/viem@2.21.45/chains";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const WALLET_RE = /^0x[a-fA-F0-9]{40}$/;

const client = createPublicClient({ chain: base, transport: http("https://mainnet.base.org") });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { wallet, expires_at, signature } = await req.json();
    if (
      typeof wallet !== "string" || !WALLET_RE.test(wallet) ||
      typeof expires_at !== "number" || typeof signature !== "string"
    ) return json({ error: "Invalid payload" }, 400);

    if (expires_at < Date.now()) return json({ error: "Expired" }, 400);

    const message = `pop-redeem:${wallet}:${expires_at}`;
    // verifyMessage handles smart-account (EIP-1271) signatures via the public client.
    const ok = await client.verifyMessage({
      address: wallet as `0x${string}`,
      message,
      signature: signature as `0x${string}`,
    });
    if (!ok) return json({ error: "Bad signature" }, 400);

    return json({ ok: true });
  } catch (e) {
    console.error("vendor-redeem-verify error", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

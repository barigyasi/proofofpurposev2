import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const WALLET_RE = /^0x[a-fA-F0-9]{40}$/;

function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { walletAddress } = await req.json();
    if (typeof walletAddress !== "string" || !WALLET_RE.test(walletAddress)) {
      return new Response(JSON.stringify({ error: "Invalid wallet address" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const wallet = walletAddress.toLowerCase();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const nonce = randomHex(32);
    const expires = new Date(Date.now() + 5 * 60 * 1000);

    const { error } = await supabase
      .from("wallet_auth_nonces")
      .upsert({
        wallet_address: wallet,
        nonce,
        expires_at: expires.toISOString(),
      });
    if (error) throw error;

    const message = `Sign in to Proof of Purpose\n\nWallet: ${wallet}\nNonce: ${nonce}\nExpires: ${expires.toISOString()}`;
    return new Response(JSON.stringify({ nonce, message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("wallet-auth-nonce error", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

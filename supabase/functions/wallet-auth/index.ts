import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { createPublicClient, http } from "https://esm.sh/viem@2.21.45";
import { base } from "https://esm.sh/viem@2.21.45/chains";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const WALLET_RE = /^0x[a-fA-F0-9]{40}$/;

const publicClient = createPublicClient({
  chain: base,
  transport: http("https://mainnet.base.org"),
});

async function derivePassword(wallet: string): Promise<string> {
  const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(`pop:${wallet}`));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { walletAddress, signature, message } = await req.json();
    if (
      typeof walletAddress !== "string" ||
      !WALLET_RE.test(walletAddress) ||
      typeof signature !== "string" ||
      typeof message !== "string"
    ) {
      return new Response(JSON.stringify({ error: "Invalid input" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const wallet = walletAddress.toLowerCase();

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Look up + delete nonce
    const { data: nonceRow, error: nonceErr } = await admin
      .from("wallet_auth_nonces")
      .select("*")
      .eq("wallet_address", wallet)
      .maybeSingle();
    if (nonceErr) throw nonceErr;
    if (!nonceRow || new Date(nonceRow.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: "Nonce missing or expired" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!message.includes(nonceRow.nonce)) {
      return new Response(JSON.stringify({ error: "Nonce mismatch" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify signature (works for EOAs and ERC-1271 smart accounts)
    const valid = await publicClient.verifyMessage({
      address: wallet as `0x${string}`,
      message,
      signature: signature as `0x${string}`,
    });
    if (!valid) {
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await admin.from("wallet_auth_nonces").delete().eq("wallet_address", wallet);

    const email = `${wallet}@wallet.local`;
    const password = await derivePassword(wallet);

    // Find or create user
    let userId: string | null = null;
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const existing = list?.users?.find((u) => u.email === email);
    if (existing) {
      userId = existing.id;
    } else {
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { wallet_address: wallet },
      });
      if (createErr) throw createErr;
      userId = created.user!.id;
    }

    // Upsert profile
    await admin.from("profiles").upsert(
      { id: userId, wallet_address: wallet },
      { onConflict: "id" },
    );

    // Sign in to get a session
    const anon = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
    );
    const { data: signIn, error: signInErr } = await anon.auth.signInWithPassword({
      email,
      password,
    });
    if (signInErr) throw signInErr;

    // Fire-and-forget admin allowlist grant
    const url = `${Deno.env.get("SUPABASE_URL")!}/functions/v1/grant-admin`;
    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")!}`,
      },
      body: JSON.stringify({ walletAddress: wallet, userId }),
    }).catch((e) => console.warn("grant-admin call failed", e));

    return new Response(
      JSON.stringify({
        userId,
        session: {
          access_token: signIn.session!.access_token,
          refresh_token: signIn.session!.refresh_token,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("wallet-auth error", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

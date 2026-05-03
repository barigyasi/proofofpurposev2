import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { createPublicClient, http } from "https://esm.sh/viem@2.21.45";
import { mainnet } from "https://esm.sh/viem@2.21.45/chains";
import { normalize } from "https://esm.sh/viem@2.21.45/ens";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const WALLET_RE = /^0x[a-fA-F0-9]{40}$/;

const STATIC_ALLOWLIST = ["0xa5a484af10ff67257a06ddbf8dde6a99a483f098"];
const ENS_ALLOWLIST = ["gyasi.eth"];

const mainnetClient = createPublicClient({
  chain: mainnet,
  transport: http("https://ethereum-rpc.publicnode.com"),
});

let resolvedAllowlistCache: string[] | null = null;

async function getAllowlist(): Promise<string[]> {
  if (resolvedAllowlistCache) return resolvedAllowlistCache;
  const out = [...STATIC_ALLOWLIST];
  for (const ens of ENS_ALLOWLIST) {
    try {
      const addr = await mainnetClient.getEnsAddress({ name: normalize(ens) });
      if (addr) out.push(addr.toLowerCase());
    } catch (e) {
      console.warn(`ENS resolve failed for ${ens}`, e);
    }
  }
  resolvedAllowlistCache = out;
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { walletAddress, userId } = await req.json();
    if (
      typeof walletAddress !== "string" ||
      !WALLET_RE.test(walletAddress) ||
      typeof userId !== "string"
    ) {
      return new Response(JSON.stringify({ error: "Invalid input" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const wallet = walletAddress.toLowerCase();
    const allowlist = await getAllowlist();
    if (!allowlist.includes(wallet)) {
      return new Response(JSON.stringify({ granted: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { error } = await admin
      .from("user_roles")
      .upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });
    if (error) throw error;

    return new Response(JSON.stringify({ granted: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("grant-admin error", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const WALLET_RE = /^0x[a-fA-F0-9]{40}$/;

async function grant(role: "vendor" | "catalyst", req: Request) {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { walletAddress } = await req.json();
    if (typeof walletAddress !== "string" || !WALLET_RE.test(walletAddress)) {
      return json({ error: "Invalid wallet" }, 400);
    }
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) return json({ error: "Forbidden" }, 403);

    // find user by wallet_address in profiles
    const { data: prof } = await admin
      .from("profiles")
      .select("id")
      .ilike("wallet_address", walletAddress)
      .maybeSingle();
    if (!prof) return json({ error: "No user with that wallet has signed in yet" }, 404);

    const { error } = await admin
      .from("user_roles")
      .upsert({ user_id: prof.id, role }, { onConflict: "user_id,role" });
    if (error) throw error;

    if (role === "catalyst") {
      await admin.from("catalyst_orgs")
        .update({ approved: true, approved_at: new Date().toISOString(), approved_by: user.id })
        .ilike("wallet_address", walletAddress);
    }

    return json({ granted: true, role });
  } catch (e) {
    console.error(`grant-${role} error`, e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export { grant, corsHeaders, json, WALLET_RE };

Deno.serve((req) => grant("catalyst", req));

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const WALLET_RE = /^0x[a-fA-F0-9]{40}$/;

Deno.serve(async (req) => {
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

    const { data: prof } = await admin
      .from("profiles").select("id").ilike("wallet_address", walletAddress).maybeSingle();
    if (!prof) return json({ error: "No user with that wallet has signed in yet" }, 404);

    const { error } = await admin
      .from("user_roles")
      .upsert({ user_id: prof.id, role: "vendor" }, { onConflict: "user_id,role" });
    if (error) throw error;

    return json({ granted: true });
  } catch (e) {
    console.error("grant-vendor-role error", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

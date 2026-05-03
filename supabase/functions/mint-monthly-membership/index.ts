// Records monthly membership intent for a donor. Mints on-chain when MEMBERSHIP_NFT_ADDRESS is set.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const MIN_DONATION_USDC = 5;

function monthKeyFromDate(d: Date): number {
  return d.getUTCFullYear() * 100 + (d.getUTCMonth() + 1);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { donation_id } = await req.json();
    if (!donation_id) {
      return new Response(JSON.stringify({ error: "donation_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: donation, error: dErr } = await supabase
      .from("donations")
      .select("id, donor_wallet, amount_usdc, created_at, status")
      .eq("id", donation_id)
      .maybeSingle();

    if (dErr || !donation) {
      return new Response(JSON.stringify({ error: "donation not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (Number(donation.amount_usdc) < MIN_DONATION_USDC) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "below_minimum" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const monthKey = monthKeyFromDate(new Date(donation.created_at));

    // Already minted/recorded for this wallet+month?
    const { data: existing } = await supabase
      .from("membership_mints")
      .select("id, status, token_id")
      .eq("donor_wallet", donation.donor_wallet)
      .eq("month_key", monthKey)
      .maybeSingle();

    if (existing) {
      return new Response(
        JSON.stringify({ already_minted: true, mint: existing }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const contractAddress = Deno.env.get("MEMBERSHIP_NFT_ADDRESS") ?? null;

    const { data: inserted, error: iErr } = await supabase
      .from("membership_mints")
      .insert({
        donor_wallet: donation.donor_wallet,
        month_key: monthKey,
        contract_address: contractAddress,
        status: contractAddress ? "pending_mint" : "pending_contract",
      })
      .select()
      .single();

    if (iErr) throw iErr;

    // TODO: when MEMBERSHIP_NFT_ADDRESS is configured, call mintFor() with
    // BOUNTY_ADMIN_PRIVATE_KEY and update token_id + tx_hash + status='minted'.

    return new Response(JSON.stringify({ ok: true, mint: inserted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

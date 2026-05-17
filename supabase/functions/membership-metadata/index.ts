// Public OpenSea-style metadata endpoint for MembershipNFT.
// URL: /functions/v1/membership-metadata/<tokenId>
// Contract baseURI should be set to "<this URL prefix>/" (trailing slash).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const MEMBERSHIP_NFT = (Deno.env.get("MEMBERSHIP_NFT_ADDRESS") ?? "").toLowerCase();

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=60" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  // path: /membership-metadata/<tokenId>  (Supabase strips /functions/v1)
  const parts = url.pathname.split("/").filter(Boolean);
  const raw = parts[parts.length - 1];
  const tokenId = raw && /^\d+$/.test(raw) ? Number(raw) : null;
  if (tokenId === null) return json({ error: "invalid token id" }, 400);

  // Look up the mint row → stamped edition
  let mintQuery = supabase
    .from("membership_mints")
    .select("token_id, contract_address, donor_wallet, edition_id, created_at, membership_editions(name, description, image_url, animation_url, slug)")
    .eq("token_id", tokenId)
    .order("created_at", { ascending: false })
    .limit(1);
  if (MEMBERSHIP_NFT) mintQuery = mintQuery.ilike("contract_address", MEMBERSHIP_NFT);

  const { data: mint } = await mintQuery.maybeSingle();

  // Fallback: latest active edition (covers tokens minted before stamping)
  let edition = mint?.membership_editions as
    | { name: string; description: string | null; image_url: string; animation_url: string | null; slug: string }
    | null
    | undefined;

  if (!edition) {
    const { data: fallback } = await supabase
      .from("membership_editions")
      .select("name, description, image_url, animation_url, slug")
      .eq("active", true)
      .maybeSingle();
    edition = fallback ?? undefined;
  }

  if (!edition) {
    return json({
      name: `Proof of Purpose Membership #${tokenId}`,
      description: "Soulbound monthly membership pass.",
      image: "",
      attributes: [{ trait_type: "Token ID", value: tokenId }],
    });
  }

  return json({
    name: `${edition.name} #${tokenId}`,
    description: edition.description ?? "Proof of Purpose monthly membership.",
    image: edition.image_url,
    animation_url: edition.animation_url ?? undefined,
    external_url: `https://proofofpurpose.org/champion`,
    attributes: [
      { trait_type: "Edition", value: edition.name },
      { trait_type: "Edition Slug", value: edition.slug },
      { trait_type: "Token ID", value: tokenId },
      ...(mint?.donor_wallet ? [{ trait_type: "Wallet", value: mint.donor_wallet }] : []),
      ...(mint?.created_at ? [{ trait_type: "Minted", value: mint.created_at }] : []),
    ],
  });
});

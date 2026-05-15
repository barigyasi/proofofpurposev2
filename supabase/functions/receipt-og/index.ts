// Crawler-friendly OG renderer for /receipts/:id share links.
// Browsers get a 302 to the SPA route; crawlers get static HTML with og:* tags.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CRAWLER_UA = /facebookexternalhit|Twitterbot|LinkedInBot|Slackbot|Discordbot|WhatsApp|TelegramBot|Pinterest|redditbot|Embedly|Googlebot|bingbot|Applebot|Yandex|DuckDuckBot|SkypeUriPreview|vkShare|W3C_Validator|baiduspider|bot|crawler|spider/i;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
};

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function html({ title, description, image, url }: { title: string; description: string; image: string; url: string }) {
  return `<!doctype html><html lang="en"><head>
<meta charset="utf-8" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}" />
<link rel="canonical" href="${esc(url)}" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(description)}" />
<meta property="og:image" content="${esc(image)}" />
<meta property="og:url" content="${esc(url)}" />
<meta property="og:type" content="article" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${esc(title)}" />
<meta name="twitter:description" content="${esc(description)}" />
<meta name="twitter:image" content="${esc(image)}" />
<meta http-equiv="refresh" content="0; url=${esc(url)}" />
</head><body><p>Redirecting to <a href="${esc(url)}">${esc(url)}</a>…</p></body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  // path: /receipt-og/:id  OR  /receipt-og?id=
  const idFromPath = url.pathname.split("/").filter(Boolean).pop();
  const idParam = url.searchParams.get("id") ?? (idFromPath && idFromPath !== "receipt-og" ? idFromPath : null);
  const ua = req.headers.get("user-agent") ?? "";
  const isCrawler = CRAWLER_UA.test(ua);

  // Build the canonical SPA URL we want humans + crawlers to reference.
  const origin = req.headers.get("x-forwarded-host")
    ? `https://${req.headers.get("x-forwarded-host")}`
    : (url.searchParams.get("origin") || "https://popmgm.org");
  const spaUrl = idParam ? `${origin}/receipts/${idParam}` : origin;

  if (!isCrawler) {
    return Response.redirect(spaUrl, 302);
  }

  let title = "POP Receipt — Proof of Purpose";
  let description = "On-chain donation receipt minted on Base. Verifiable forever.";

  if (idParam && /^\d+$/.test(idParam)) {
    try {
      const sb = createClient(SUPABASE_URL, SERVICE_KEY);
      const { data } = await sb
        .from("vendor_charges")
        .select("purpose_amount_wei, usdc_payout, vendor_wallet, captured_at, memo")
        .eq("receipt_token_id", Number(idParam))
        .maybeSingle();
      if (data) {
        const purpose = Number(data.purpose_amount_wei ?? 0) / 1e18;
        title = `POP Receipt #${idParam} — ${purpose.toFixed(2)} $PURPOSE`;
        const usdc = data.usdc_payout ? ` · ${Number(data.usdc_payout).toFixed(2)} USDC settled` : "";
        description = `On-chain proof of a community redemption on Base.${usdc} Verifiable forever at popmgm.org.`;
      } else {
        title = `POP Receipt #${idParam} — Proof of Purpose`;
        description = `On-chain donation receipt #${idParam} minted on Base. Verifiable forever.`;
      }
    } catch (_e) {
      // fall through to defaults
    }
  }

  const image = `${origin}/og-image.png`;

  return new Response(html({ title, description, image, url: spaUrl }), {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=300, s-maxage=600",
      ...corsHeaders,
    },
  });
});

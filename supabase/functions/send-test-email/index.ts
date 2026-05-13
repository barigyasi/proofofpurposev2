// One-off test sender — brutalist branding check.
import { brutalShell, brutalRow } from "../_shared/brutalEmail.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM = "Proof of Purpose <receipts@popmgm.org>";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    if (!RESEND_API_KEY) return new Response(JSON.stringify({ error: "RESEND_API_KEY missing" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const body = await req.json().catch(() => ({})) as { to?: string };
    const to = body.to ?? "barigyasi@gmail.com";

    const html = brutalShell({
      title: "Proof of Purpose — branding test",
      eyebrow: "TEST",
      heading: "Branding check",
      subheading: "receipts@popmgm.org",
      intro: "If this email matches the brutalist look of the app — acid yellow on near-black, Archivo Black display, sharp borders — then the branding is wired correctly.",
      rowsHtml: [
        brutalRow("From", "receipts@popmgm.org"),
        brutalRow("To", to),
        brutalRow("Sent", new Date().toUTCString()),
      ].join(""),
      ctaUrl: "https://popmgm.org",
      ctaLabel: "Open app",
      footerNote: "// branding test · safe to delete",
    });

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [to], subject: "Proof of Purpose — branding test", html, text: "Branding test from popmgm.org" }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return new Response(JSON.stringify({ error: `Resend ${res.status}`, detail: json }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    return new Response(JSON.stringify({ ok: true, to, id: json.id ?? null }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as any)?.message ?? e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

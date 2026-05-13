// admin-notify
// Sends brutalist-branded admin alerts to admin@popmgm.org for:
//   - new wallet/profile created
//   - new waitlist signup
//   - new application (champion/catalyst/vendor) — extensible
// Invoked from DB triggers via pg_net OR directly from edge functions/UI.

import { brutalShell, brutalRow, escapeHtml } from "../_shared/brutalEmail.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM = "Proof of Purpose <alerts@popmgm.org>";
const TO = Deno.env.get("ADMIN_NOTIFY_TO") ?? "admin@popmgm.org";
const APP_BASE_URL = Deno.env.get("APP_BASE_URL") ?? "https://popmgm.org";

type Kind = "profile" | "waitlist" | "application" | "generic";

interface Payload {
  kind: Kind;
  // free-form record passthrough from triggers
  record?: Record<string, unknown>;
  // optional overrides
  subject?: string;
  heading?: string;
  intro?: string;
  ctaUrl?: string;
  ctaLabel?: string;
}

function shortAddr(a?: string) {
  if (!a || typeof a !== "string") return "—";
  return a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;
}

function buildEmail(p: Payload): { subject: string; html: string; text: string } {
  const r = (p.record ?? {}) as Record<string, any>;

  if (p.kind === "profile") {
    const wallet = String(r.wallet_address ?? "");
    const display = r.display_name || r.username || "—";
    const email = r.email || "—";
    const subject = p.subject ?? `New wallet → ${shortAddr(wallet)}`;
    const rows = [
      brutalRow("Wallet", `<a href="https://basescan.org/address/${wallet}" style="color:#ffff00;text-decoration:none;font-family:'JetBrains Mono','Courier New',monospace;">${escapeHtml(wallet)}</a>`),
      brutalRow("Display", escapeHtml(String(display))),
      brutalRow("Email", escapeHtml(String(email))),
      brutalRow("Created", new Date(String(r.created_at ?? Date.now())).toUTCString()),
    ].join("");
    return {
      subject,
      html: brutalShell({
        title: subject,
        eyebrow: "ADMIN ALERT",
        heading: "New wallet",
        subheading: shortAddr(wallet),
        intro: "A new wallet just hit the database — a profile row was created.",
        rowsHtml: rows,
        ctaUrl: `${APP_BASE_URL}/admin`,
        ctaLabel: "Open Admin",
        footerNote: "// profiles.insert · popmgm.org",
      }),
      text: `New wallet ${wallet}\nDisplay: ${display}\nEmail: ${email}`,
    };
  }

  if (p.kind === "waitlist") {
    const name = String(r.name ?? "—");
    const city = String(r.city ?? "—");
    const email = String(r.email ?? "—");
    const subject = p.subject ?? `Waitlist signup → ${name} (${city})`;
    const rows = [
      brutalRow("Name", escapeHtml(name)),
      brutalRow("City", escapeHtml(city)),
      brutalRow("Email", escapeHtml(email)),
      brutalRow("Created", new Date(String(r.created_at ?? Date.now())).toUTCString()),
    ].join("");
    return {
      subject,
      html: brutalShell({
        title: subject,
        eyebrow: "WAITLIST",
        heading: "New waitlist signup",
        subheading: city.toUpperCase(),
        intro: `${escapeHtml(name)} just joined the waitlist.`,
        rowsHtml: rows,
        ctaUrl: `${APP_BASE_URL}/admin/waitlist`,
        ctaLabel: "View waitlist",
        footerNote: "// waitlist_signups.insert · popmgm.org",
      }),
      text: `Waitlist signup\nName: ${name}\nCity: ${city}\nEmail: ${email}`,
    };
  }

  if (p.kind === "application") {
    const role = String(r.role ?? r.applicant_role ?? "applicant");
    const wallet = String(r.wallet_address ?? "");
    const subject = p.subject ?? `New ${role} application → ${shortAddr(wallet)}`;
    const rows = Object.entries(r)
      .filter(([k]) => !["id", "updated_at"].includes(k))
      .slice(0, 12)
      .map(([k, v]) => brutalRow(k, escapeHtml(String(v ?? "—"))))
      .join("");
    return {
      subject,
      html: brutalShell({
        title: subject,
        eyebrow: "APPLICATION",
        heading: `New ${role}`,
        subheading: shortAddr(wallet),
        intro: "A new application was submitted.",
        rowsHtml: rows,
        ctaUrl: `${APP_BASE_URL}/admin/applicants`,
        ctaLabel: "Review applicants",
      }),
      text: `New ${role} application from ${wallet}`,
    };
  }

  // generic
  const subject = p.subject ?? "Proof of Purpose — admin notification";
  return {
    subject,
    html: brutalShell({
      title: subject,
      eyebrow: "ADMIN",
      heading: p.heading ?? "Notification",
      intro: p.intro ?? "An event occurred in the system.",
      rowsHtml: Object.entries(r).map(([k, v]) => brutalRow(k, escapeHtml(String(v ?? "—")))).join(""),
      ctaUrl: p.ctaUrl,
      ctaLabel: p.ctaLabel,
    }),
    text: JSON.stringify(r, null, 2),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    if (!RESEND_API_KEY) return json({ error: "RESEND_API_KEY missing" }, 500);
    const body = (await req.json().catch(() => ({}))) as Payload;
    if (!body || !body.kind) return json({ error: "kind required" }, 400);

    const { subject, html, text } = buildEmail(body);

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: [TO],
        subject,
        html,
        text,
      }),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) return json({ error: `Resend ${res.status}`, detail: out }, 500);
    return json({ ok: true, to: TO, id: out.id ?? null });
  } catch (e) {
    console.error("admin-notify error", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

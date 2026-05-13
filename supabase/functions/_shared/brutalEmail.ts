// Shared brutalist email shell — Proof of Purpose
// Acid yellow (#ffff00) on near-black (#0a0a0a), Archivo Black display,
// JetBrains Mono labels, sharp 2px borders, no radius.

export function escapeHtml(s: string): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]!));
}

export function brutalRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:12px 0;border-bottom:1px solid #2a2a2a;color:#888888;font-family:'JetBrains Mono','Courier New',monospace;font-size:11px;text-transform:uppercase;letter-spacing:0.1em;width:42%;">${label}</td>
    <td align="right" style="padding:12px 0;border-bottom:1px solid #2a2a2a;color:#fafafa;font-size:14px;font-weight:600;word-break:break-all;">${value}</td>
  </tr>`;
}

export interface BrutalShellOpts {
  title: string;            // <title>
  eyebrow?: string;         // top-right small label, e.g. "ADMIN ALERT"
  heading: string;          // big display heading (will be uppercased)
  subheading?: string;      // secondary line under heading
  intro?: string;           // paragraph above rows
  rowsHtml?: string;        // table rows from brutalRow()
  ctaLabel?: string;
  ctaUrl?: string;
  footerNote?: string;      // // small mono text in footer
  preheader?: string;
}

export function brutalShell(o: BrutalShellOpts): string {
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="color-scheme" content="dark"/>
<title>${escapeHtml(o.title)}</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#fafafa;">
${o.preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(o.preheader)}</div>` : ""}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0a0a0a;">
  <tr><td align="center" style="padding:32px 12px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#141414;border:2px solid #fafafa;border-collapse:separate;">
      <tr><td style="background:#0a0a0a;padding:24px 24px 20px 24px;border-bottom:2px solid #fafafa;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td valign="middle" style="vertical-align:middle;">
              <img src="https://szlnvjzluzplpvzigboo.supabase.co/storage/v1/object/public/email-assets/pop-logo.png" alt="Proof of Purpose" width="180" style="display:block;width:180px;height:auto;max-width:180px;border:0;outline:none;text-decoration:none;"/>
            </td>
            <td align="right" valign="top" style="vertical-align:top;font-family:'JetBrains Mono','Courier New',monospace;font-size:11px;color:#ffff00;text-transform:uppercase;letter-spacing:0.1em;">${escapeHtml(o.eyebrow ?? "")}</td>
          </tr>
        </table>
      </td></tr>
      <tr><td style="background:#ffff00;padding:0;line-height:0;font-size:0;height:6px;">&nbsp;</td></tr>
      <tr><td style="padding:28px 28px 8px 28px;">
        <h1 style="margin:0 0 8px 0;font-family:'Archivo Black',Impact,'Arial Black',sans-serif;font-weight:900;font-size:32px;line-height:0.95;letter-spacing:-0.04em;color:#fafafa;text-transform:uppercase;">${escapeHtml(o.heading).toUpperCase()}</h1>
        ${o.subheading ? `<div style="font-family:'JetBrains Mono','Courier New',monospace;font-size:14px;color:#ffff00;letter-spacing:0.02em;margin-bottom:14px;">${escapeHtml(o.subheading)}</div>` : ""}
        ${o.intro ? `<p style="margin:8px 0 16px 0;font-size:14px;line-height:1.6;color:#cccccc;">${o.intro}</p>` : ""}
      </td></tr>
      ${o.rowsHtml ? `<tr><td style="padding:8px 28px 8px 28px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:14px;color:#fafafa;border-top:2px solid #fafafa;">
          ${o.rowsHtml}
        </table>
      </td></tr>` : ""}
      ${o.ctaLabel && o.ctaUrl ? `<tr><td align="center" style="padding:24px 28px 8px 28px;">
        <a href="${o.ctaUrl}" style="display:inline-block;background:#ffff00;color:#0a0a0a;font-family:'Archivo Black',Impact,'Arial Black',sans-serif;font-weight:900;text-decoration:none;padding:16px 28px;font-size:15px;letter-spacing:0.02em;text-transform:uppercase;border:2px solid #fafafa;">${escapeHtml(o.ctaLabel)} →</a>
      </td></tr>` : ""}
      <tr><td style="padding:24px 28px 24px 28px;">
        <p style="margin:0;font-family:'JetBrains Mono','Courier New',monospace;font-size:11px;line-height:1.6;color:#888888;text-transform:uppercase;letter-spacing:0.06em;">
          ${o.footerNote ?? "// Proof of Purpose — built on Base."}
        </p>
      </td></tr>
    </table>
    <p style="margin:18px 0 0 0;font-family:'JetBrains Mono','Courier New',monospace;font-size:10px;color:#666666;text-transform:uppercase;letter-spacing:0.1em;">PROOF OF PURPOSE · popmgm.org</p>
  </td></tr>
</table>
</body></html>`;
}

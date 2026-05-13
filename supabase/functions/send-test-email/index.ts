// One-off test sender to verify popmgm.org is live in Resend.
// Safe to delete after verification.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM = "Purpose Receipts <receipts@popmgm.org>";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY missing" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({})) as { to?: string };
    const to = body.to ?? "barigyasi@gmail.com";

    const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:#0a1228;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#e8ecf5;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0a1228;">
  <tr><td align="center" style="padding:32px 12px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#0f1a3a;border:1px solid #1f2c54;border-radius:12px;overflow:hidden;">
      <tr><td style="padding:32px 32px 12px 32px;">
        <div style="font-family:Georgia,serif;font-weight:700;letter-spacing:0.18em;font-size:14px;color:#f5c542;">PURPOSE</div>
        <div style="font-size:11px;color:#8a96b8;letter-spacing:0.1em;text-transform:uppercase;margin-top:4px;">Test Email</div>
      </td></tr>
      <tr><td style="padding:8px 32px 8px 32px;">
        <h1 style="margin:12px 0 12px 0;font-size:24px;line-height:1.2;color:#ffffff;">Domain verification successful</h1>
        <p style="margin:0 0 14px 0;font-size:14px;line-height:1.6;color:#c2cbe3;">
          This is a test email from <strong style="color:#f5c542;">receipts@popmgm.org</strong> via Resend.
          If you're reading this in your inbox (not spam), the domain is verified and ready
          to deliver on-chain receipt emails to champions and vendors.
        </p>
        <p style="margin:0 0 14px 0;font-size:14px;line-height:1.6;color:#c2cbe3;">
          Once the V2 contracts (including <strong>ReceiptNFT</strong>) are deployed and
          <code style="background:#1f2c54;padding:2px 6px;border-radius:4px;color:#f5c542;">RECEIPT_NFT_ADDRESS</code>
          is set, settled redemptions will auto-trigger branded receipts with PNG + PDF attachments.
        </p>
      </td></tr>
      <tr><td style="padding:18px 32px 32px 32px;">
        <p style="margin:0;font-size:11px;line-height:1.6;color:#7d89ab;">
          Sent by Purpose · receipts@popmgm.org · Test ${new Date().toISOString()}
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;

    const text = [
      "Purpose — Domain verification test",
      "",
      "This is a test email from receipts@popmgm.org via Resend.",
      "If it's in your inbox (not spam), the domain is verified and ready to deliver receipts.",
      "",
      `Sent ${new Date().toISOString()}`,
    ].join("\n");

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: [to],
        subject: "Purpose — receipts@popmgm.org test email",
        html,
        text,
      }),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return new Response(JSON.stringify({ error: `Resend ${res.status}`, detail: json }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ ok: true, to, id: json.id ?? null }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

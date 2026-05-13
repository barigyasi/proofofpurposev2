// receipt-email
// Sends a branded receipt email (with on-chain SVG inlined + PNG/PDF attachments)
// to the champion and/or vendor for a given receipt token.
// Uses Resend REST API with from = receipts@popmgm.org.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { createPublicClient, http, parseAbi } from "https://esm.sh/viem@2.21.45";
import { base } from "https://esm.sh/viem@2.21.45/chains";
import { initWasm, Resvg } from "https://esm.sh/@resvg/resvg-wasm@2.6.2";
import { PDFDocument } from "https://esm.sh/pdf-lib@1.17.1";
import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RECEIPT_ABI = parseAbi([
  "function tokenURI(uint256 tokenId) view returns (string)",
  "function receipts(uint256) view returns (address champion, address vendor, uint256 usdcAmount, uint256 purposeAmount, bytes32 chargeId, uint64 settledAt, string championName, string vendorName)",
]);

const FROM = "Purpose Receipts <receipts@popmgm.org>";
const RPC = Deno.env.get("CHAIN_RPC") ?? "https://mainnet.base.org";
const RECEIPT_NFT = (Deno.env.get("RECEIPT_NFT_ADDRESS") ?? "").toLowerCase();
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const APP_BASE_URL = Deno.env.get("APP_BASE_URL") ?? "https://popmgm.org";

let wasmReady: Promise<void> | null = null;
async function ensureWasm() {
  if (!wasmReady) {
    wasmReady = (async () => {
      const res = await fetch("https://esm.sh/@resvg/resvg-wasm@2.6.2/index_bg.wasm");
      const bytes = await res.arrayBuffer();
      await initWasm(bytes);
    })();
  }
  return wasmReady;
}

function parseTokenURI(uri: string): { name?: string; image?: string; raw?: string } {
  if (uri.startsWith("data:application/json;base64,")) {
    try {
      const json = JSON.parse(atob(uri.slice("data:application/json;base64,".length)));
      return json;
    } catch { return { raw: uri }; }
  }
  if (uri.startsWith("data:application/json,")) {
    try { return JSON.parse(decodeURIComponent(uri.slice("data:application/json,".length))); } catch { return { raw: uri }; }
  }
  return { raw: uri };
}

function extractSvg(image?: string): string | null {
  if (!image) return null;
  if (image.startsWith("data:image/svg+xml;base64,")) return atob(image.slice("data:image/svg+xml;base64,".length));
  if (image.startsWith("data:image/svg+xml;utf8,")) return decodeURIComponent(image.slice("data:image/svg+xml;utf8,".length));
  if (image.startsWith("data:image/svg+xml,")) return decodeURIComponent(image.slice("data:image/svg+xml,".length));
  if (image.trim().startsWith("<svg")) return image;
  return null;
}

async function svgToPng(svg: string, width = 1200): Promise<Uint8Array> {
  await ensureWasm();
  const r = new Resvg(svg, { fitTo: { mode: "width", value: width }, background: "rgba(0,0,0,0)" });
  return r.render().asPng();
}

async function pngToPdf(png: Uint8Array, opts: { title: string }): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(opts.title);
  const img = await doc.embedPng(png);
  // A4 portrait at 72dpi: 595 x 842
  const pageW = 595, pageH = 842;
  const page = doc.addPage([pageW, pageH]);
  const margin = 36;
  const maxW = pageW - margin * 2;
  const maxH = pageH - margin * 2;
  const scale = Math.min(maxW / img.width, maxH / img.height);
  const w = img.width * scale, h = img.height * scale;
  page.drawImage(img, { x: (pageW - w) / 2, y: (pageH - h) / 2, width: w, height: h });
  return await doc.save();
}

function fmtUSD(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}
function fmtPurpose(wei: bigint) {
  const whole = Number(wei / 10n ** 14n) / 1e4;
  return `${whole.toLocaleString(undefined, { maximumFractionDigits: 4 })} $P`;
}
function shortHash(h: string) { return h.slice(0, 10) + "…" + h.slice(-8); }
function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function renderHtml(p: {
  recipientKind: "champion" | "vendor";
  championName: string;
  vendorName: string;
  usdc: number;
  purposeWei: bigint;
  settledAt: Date;
  txHash: string;
  tokenId: string;
  receiptUrl: string;
}): string {
  const heading = p.recipientKind === "champion" ? "Your receipt" : "New settled redemption";
  const sub = p.recipientKind === "champion"
    ? `A soulbound on-chain receipt has been minted to your wallet for your purchase at ${escapeHtml(p.vendorName)}.`
    : `A redemption from ${escapeHtml(p.championName)} has settled. Receipt #${p.tokenId} is attached.`;

  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="color-scheme" content="dark"/>
<title>PROOF OF PURPOSE — RECEIPT #${p.tokenId}</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#fafafa;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0a0a0a;">
  <tr><td align="center" style="padding:32px 12px;">
    <!-- Hard offset shadow wrapper -->
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;">
      <tr>
        <td style="padding:0;">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#141414;border:2px solid #fafafa;border-collapse:separate;">
            <tr><td style="background:#ffffff;padding:20px 24px;border-bottom:2px solid #fafafa;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td valign="middle" style="vertical-align:middle;">
                    <img src="https://szlnvjzluzplpvzigboo.supabase.co/storage/v1/object/public/email-assets/pop-mark.png" alt="POP — Proof of Purpose" width="120" style="display:block;width:120px;height:auto;max-width:120px;border:0;outline:none;text-decoration:none;"/>
                  </td>
                  <td align="right" valign="middle" style="vertical-align:middle;font-family:'JetBrains Mono','Courier New',monospace;font-size:11px;color:#0a0a0a;text-transform:uppercase;letter-spacing:0.1em;font-weight:700;">SOULBOUND<br/>RECEIPT</td>
                </tr>
              </table>
            </td></tr>
            <tr><td style="padding:28px 28px 8px 28px;">
              <h1 style="margin:0 0 8px 0;font-family:'Archivo Black',Impact,'Arial Black',sans-serif;font-weight:900;font-size:34px;line-height:0.95;letter-spacing:-0.04em;color:#fafafa;text-transform:uppercase;">${heading.toUpperCase()}</h1>
              <div style="font-family:'JetBrains Mono','Courier New',monospace;font-size:18px;color:#ffff00;letter-spacing:0.02em;margin-bottom:14px;">#${p.tokenId}</div>
              <p style="margin:0 0 16px 0;font-size:14px;line-height:1.55;color:#cccccc;">${sub}</p>
            </td></tr>
            <tr><td align="center" style="padding:8px 24px 16px 24px;">
              <img src="cid:receipt-png" alt="Receipt #${p.tokenId}" style="display:block;width:100%;max-width:540px;height:auto;border:2px solid #fafafa;"/>
            </td></tr>
            <tr><td style="padding:8px 28px 8px 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:14px;color:#fafafa;border-top:2px solid #fafafa;">
                ${row("Champion", escapeHtml(p.championName))}
                ${row("Vendor", escapeHtml(p.vendorName))}
                ${row("Amount paid out", fmtUSD(p.usdc))}
                ${row("PURPOSE redeemed", fmtPurpose(p.purposeWei))}
                ${row("Settled", p.settledAt.toUTCString())}
                ${row("Transaction", `<a href="https://basescan.org/tx/${p.txHash}" style="color:#ffff00;text-decoration:none;font-family:'JetBrains Mono','Courier New',monospace;">${shortHash(p.txHash)}</a>`)}
              </table>
            </td></tr>
            <tr><td align="center" style="padding:24px 28px 28px 28px;">
              <a href="${p.receiptUrl}" style="display:inline-block;background:#ffff00;color:#0a0a0a;font-family:'Archivo Black',Impact,'Arial Black',sans-serif;font-weight:900;text-decoration:none;padding:16px 28px;font-size:15px;letter-spacing:0.02em;text-transform:uppercase;border:2px solid #fafafa;">VIEW ON-CHAIN RECEIPT →</a>
            </td></tr>
            <tr><td style="padding:0 28px 24px 28px;">
              <p style="margin:0;font-family:'JetBrains Mono','Courier New',monospace;font-size:11px;line-height:1.6;color:#888888;text-transform:uppercase;letter-spacing:0.06em;">
                // Soulbound — non-transferable proof of purchase. Permanent on Base.<br/>
                // Printable PDF + PNG attached.
              </p>
            </td></tr>
          </table>
        </td>
      </tr>
    </table>
    <p style="margin:18px 0 0 0;font-family:'JetBrains Mono','Courier New',monospace;font-size:10px;color:#666666;text-transform:uppercase;letter-spacing:0.1em;">PROOF OF PURPOSE · receipts@popmgm.org</p>
  </td></tr>
</table>
</body></html>`;
}
function row(label: string, value: string) {
  return `<tr>
    <td style="padding:12px 0;border-bottom:1px solid #2a2a2a;color:#888888;font-family:'JetBrains Mono','Courier New',monospace;font-size:11px;text-transform:uppercase;letter-spacing:0.1em;">${label}</td>
    <td align="right" style="padding:12px 0;border-bottom:1px solid #2a2a2a;color:#fafafa;font-size:14px;font-weight:600;">${value}</td>
  </tr>`;
}

function renderText(p: {
  championName: string; vendorName: string; usdc: number; tokenId: string;
  txHash: string; receiptUrl: string;
}) {
  return [
    `Purpose receipt #${p.tokenId}`,
    ``,
    `Champion: ${p.championName}`,
    `Vendor:   ${p.vendorName}`,
    `Amount:   ${fmtUSD(p.usdc)}`,
    `Tx:       https://basescan.org/tx/${p.txHash}`,
    `View:     ${p.receiptUrl}`,
    ``,
    `Soulbound on-chain proof of purchase. Printable PDF/PNG attached.`,
  ].join("\n");
}

async function sendViaResend(payload: {
  to: string; subject: string; html: string; text: string;
  attachments: { filename: string; content: string; content_id?: string; type?: string }[];
}) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM,
      to: [payload.to],
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
      attachments: payload.attachments,
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Resend ${res.status}: ${JSON.stringify(json)}`);
  return json as { id?: string };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    if (!RESEND_API_KEY) return json({ error: "RESEND_API_KEY missing" }, 500);
    if (!/^0x[a-f0-9]{40}$/.test(RECEIPT_NFT)) return json({ error: "RECEIPT_NFT_ADDRESS missing" }, 503);

    const body = await req.json().catch(() => ({})) as {
      tokenId?: number | string;
      chargeId?: string;
      recipients?: ("champion" | "vendor")[];
      force?: boolean;
    };

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Resolve charge row by tokenId or chargeId
    let charge: any = null;
    if (body.chargeId) {
      const { data } = await supabase.from("vendor_charges").select("*").eq("id", body.chargeId).maybeSingle();
      charge = data;
    } else if (body.tokenId !== undefined) {
      const { data } = await supabase.from("vendor_charges").select("*").eq("receipt_token_id", Number(body.tokenId)).maybeSingle();
      charge = data;
    }
    if (!charge) return json({ error: "charge not found" }, 404);
    if (!charge.receipt_token_id) return json({ error: "receipt not minted yet" }, 400);

    const tokenId = BigInt(charge.receipt_token_id);

    // Resolve recipient emails
    const [{ data: champProfile }, { data: vendorRow }] = await Promise.all([
      supabase.from("profiles").select("email,display_name,username").ilike("wallet_address", charge.champion_wallet).maybeSingle(),
      supabase.from("vendors").select("contact_email,business_name").ilike("wallet_address", charge.vendor_wallet).maybeSingle(),
    ]);

    const championEmail = champProfile?.email ?? null;
    const vendorEmail = vendorRow?.contact_email ?? null;
    const championName = champProfile?.display_name || champProfile?.username || "Champion";
    const vendorName = vendorRow?.business_name || "Vendor";

    // Fetch on-chain receipt + SVG
    const publicClient = createPublicClient({ chain: base, transport: http(RPC) });
    const [uri, rec] = await Promise.all([
      publicClient.readContract({ address: RECEIPT_NFT as `0x${string}`, abi: RECEIPT_ABI, functionName: "tokenURI", args: [tokenId] }) as Promise<string>,
      publicClient.readContract({ address: RECEIPT_NFT as `0x${string}`, abi: RECEIPT_ABI, functionName: "receipts", args: [tokenId] }) as Promise<readonly [string, string, bigint, bigint, string, bigint, string, string]>,
    ]);

    const meta = parseTokenURI(uri);
    const svg = extractSvg(meta.image);
    if (!svg) return json({ error: "could not extract SVG from tokenURI" }, 500);

    const png = await svgToPng(svg, 1200);
    const pdf = await pngToPdf(png, { title: `Purpose Receipt #${tokenId.toString()}` });
    const pngB64 = encodeBase64(png);
    const pdfB64 = encodeBase64(pdf);

    const recipients = body.recipients ?? ["champion", "vendor"];
    const receiptUrl = `${APP_BASE_URL}/receipt/${tokenId.toString()}`;
    const usdc = Number(charge.usdc_payout ?? 0);
    const settledAt = charge.settled_at ? new Date(charge.settled_at) : new Date(Number(rec[5]) * 1000);

    const results: { kind: string; status: string; id?: string; error?: string }[] = [];

    for (const kind of recipients) {
      const to = kind === "champion" ? championEmail : vendorEmail;
      if (!to) {
        results.push({ kind, status: "skipped", error: "no email on file" });
        continue;
      }

      // Idempotency check
      if (!body.force) {
        const { data: existing } = await supabase
          .from("receipt_email_log")
          .select("id").eq("receipt_token_id", Number(tokenId))
          .eq("recipient_kind", kind).eq("status", "sent").limit(1);
        if (existing && existing.length > 0) {
          results.push({ kind, status: "already_sent" });
          continue;
        }
      }

      const subject = kind === "champion"
        ? `Your Purpose receipt #${tokenId.toString()} from ${vendorName}`
        : `Settled redemption #${tokenId.toString()} — ${fmtUSD(usdc)}`;

      const html = renderHtml({
        recipientKind: kind, championName, vendorName, usdc,
        purposeWei: BigInt(charge.purpose_amount_wei),
        settledAt, txHash: charge.tx_hash ?? charge.receipt_tx_hash ?? "", tokenId: tokenId.toString(),
        receiptUrl,
      });
      const text = renderText({
        championName, vendorName, usdc, tokenId: tokenId.toString(),
        txHash: charge.tx_hash ?? charge.receipt_tx_hash ?? "", receiptUrl,
      });

      try {
        const sent = await sendViaResend({
          to, subject, html, text,
          attachments: [
            { filename: `receipt-${tokenId.toString()}.png`, content: pngB64, content_id: "receipt-png", type: "image/png" },
            { filename: `receipt-${tokenId.toString()}.pdf`, content: pdfB64, type: "application/pdf" },
          ],
        });
        await supabase.from("receipt_email_log").insert({
          receipt_token_id: Number(tokenId), charge_id: charge.id,
          recipient_kind: kind, recipient_email: to, status: "sent", resend_id: sent.id ?? null,
        });
        if (kind === "champion") {
          await supabase.from("vendor_charges").update({ receipt_emailed_at: new Date().toISOString() }).eq("id", charge.id);
        }
        results.push({ kind, status: "sent", id: sent.id });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await supabase.from("receipt_email_log").insert({
          receipt_token_id: Number(tokenId), charge_id: charge.id,
          recipient_kind: kind, recipient_email: to, status: "failed", error: msg.slice(0, 500),
        });
        results.push({ kind, status: "failed", error: msg });
      }
    }

    return json({ ok: true, tokenId: tokenId.toString(), results });
  } catch (e) {
    console.error("receipt-email error", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

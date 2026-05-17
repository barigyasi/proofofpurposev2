// Public endpoint: serves OpenSea-style JSON metadata + inline SVG for a
// ReceiptNFT token. Reads on-chain receipt data from Base mainnet, renders the
// brutalist receipt card off-chain so we can iterate on the art without
// redeploying the contract.
//
// Route: GET /receipt-metadata/:tokenId  (or ?tokenId=)
// No auth — wallets / OpenSea fetch this anonymously.

import { createPublicClient, http, encodeFunctionData, decodeFunctionResult } from "npm:viem@2.21.40";
import { base } from "npm:viem@2.21.40/chains";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const RECEIPT_NFT_ADDRESS = (Deno.env.get("RECEIPT_NFT_ADDRESS") ?? "").toLowerCase();
const RPC_URL = Deno.env.get("BASE_RPC_URL") ?? "https://mainnet.base.org";

const getReceiptAbi = [
  {
    type: "function",
    name: "getReceipt",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "champion", type: "address" },
          { name: "vendor", type: "address" },
          { name: "usdcAmount", type: "uint256" },
          { name: "purposeAmount", type: "uint256" },
          { name: "chargeId", type: "bytes32" },
          { name: "settledAt", type: "uint64" },
          { name: "championName", type: "string" },
          { name: "vendorName", type: "string" },
        ],
      },
    ],
  },
] as const;

type Receipt = {
  champion: `0x${string}`;
  vendor: `0x${string}`;
  usdcAmount: bigint;
  purposeAmount: bigint;
  chargeId: `0x${string}`;
  settledAt: bigint;
  championName: string;
  vendorName: string;
};

const client = createPublicClient({ chain: base, transport: http(RPC_URL) });

function shortAddr(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}
function shortHex(h: string): string {
  return `${h.slice(0, 6)}…${h.slice(-4)}`;
}
function fmtUSDC(amount: bigint): string {
  const whole = amount / 1_000_000n;
  const frac = (amount % 1_000_000n) / 10_000n; // 2dp
  return `${whole}.${frac.toString().padStart(2, "0")}`;
}
function fmtPURPOSE(amount: bigint): string {
  const whole = amount / 10n ** 18n;
  const frac = (amount % 10n ** 18n) / 10n ** 16n; // 2dp
  return `${whole}.${frac.toString().padStart(2, "0")}`;
}
function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
function escapeJsonText(s: string): string {
  // Allow regular text in JSON strings (JSON.stringify handles this), this is
  // for inline attributes/description where we just want sanitized printable.
  return s.replace(/[\x00-\x1f\x7f]/g, " ");
}

function renderSvg(tokenId: string, r: Receipt): string {
  const BG = "#0A0A0A";        // near-black
  const FG = "#FAFAFA";
  const MUTED = "#8A8A8A";
  const ACCENT = "#FFFF00";    // acid yellow
  const champ = escapeXml(r.championName || "—");
  const vend = escapeXml(r.vendorName || "—");
  const usdc = fmtUSDC(r.usdcAmount);
  const purpose = fmtPURPOSE(r.purposeAmount);
  const settled = r.settledAt.toString();

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" font-family="ui-monospace, SFMono-Regular, Menlo, monospace">
  <rect width="600" height="600" fill="${BG}"/>
  <rect x="20" y="20" width="560" height="560" fill="none" stroke="${ACCENT}" stroke-width="4"/>
  <rect x="20" y="20" width="560" height="44" fill="${ACCENT}"/>
  <text x="40" y="51" fill="${BG}" font-size="16" font-weight="700" letter-spacing="4">PROOF OF PURPOSE</text>
  <text x="560" y="51" fill="${BG}" font-size="16" font-weight="700" text-anchor="end">RECEIPT</text>

  <text x="40" y="120" fill="${FG}" font-size="56" font-weight="900">#${tokenId}</text>
  <line x1="40" y1="140" x2="560" y2="140" stroke="${MUTED}" stroke-width="1"/>

  <text x="40" y="180" fill="${MUTED}" font-size="11" letter-spacing="3">CHAMPION</text>
  <text x="40" y="208" fill="${FG}" font-size="22" font-weight="700">${champ}</text>
  <text x="40" y="230" fill="${MUTED}" font-size="12">${shortAddr(r.champion)}</text>

  <text x="40" y="275" fill="${MUTED}" font-size="11" letter-spacing="3">VENDOR</text>
  <text x="40" y="303" fill="${FG}" font-size="22" font-weight="700">${vend}</text>
  <text x="40" y="325" fill="${MUTED}" font-size="12">${shortAddr(r.vendor)}</text>

  <line x1="40" y1="355" x2="560" y2="355" stroke="${MUTED}" stroke-width="1"/>

  <text x="40" y="390" fill="${MUTED}" font-size="11" letter-spacing="3">AMOUNT</text>
  <text x="40" y="455" fill="${ACCENT}" font-size="64" font-weight="900">$${usdc}</text>
  <text x="40" y="482" fill="${FG}" font-size="14">${purpose} PURPOSE redeemed</text>

  <line x1="40" y1="510" x2="560" y2="510" stroke="${MUTED}" stroke-width="1"/>

  <text x="40" y="535" fill="${MUTED}" font-size="10" letter-spacing="2">CHARGE</text>
  <text x="40" y="552" fill="${FG}" font-size="11">${shortHex(r.chargeId)}</text>
  <text x="40" y="572" fill="${MUTED}" font-size="10" letter-spacing="2">SETTLED (UNIX)  ${settled}</text>

  <rect x="430" y="525" width="130" height="34" fill="${ACCENT}"/>
  <text x="495" y="547" fill="${BG}" font-size="13" font-weight="900" text-anchor="middle">SOULBOUND</text>
</svg>`;
}

function notFound(msg: string): Response {
  return new Response(JSON.stringify({ error: msg }), {
    status: 404,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
function badRequest(msg: string): Response {
  return new Response(JSON.stringify({ error: msg }), {
    status: 400,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function parseTokenId(req: Request): bigint | null {
  // accept /receipt-metadata/123, /functions/v1/receipt-metadata/123, or ?tokenId=123
  const url = new URL(req.url);
  const q = url.searchParams.get("tokenId");
  if (q) {
    try { const n = BigInt(q); return n >= 0n ? n : null; } catch { return null; }
  }
  const parts = url.pathname.split("/").filter(Boolean);
  const last = parts[parts.length - 1];
  if (!last) return null;
  try {
    const n = BigInt(last);
    return n >= 0n ? n : null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET") {
    return new Response("method not allowed", { status: 405, headers: corsHeaders });
  }

  const tokenId = parseTokenId(req);
  if (tokenId === null) return badRequest("invalid tokenId");

  if (!RECEIPT_NFT_ADDRESS || !RECEIPT_NFT_ADDRESS.startsWith("0x")) {
    return new Response(
      JSON.stringify({ error: "RECEIPT_NFT_ADDRESS not configured" }),
      { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  let r: Receipt;
  try {
    r = (await client.readContract({
      address: RECEIPT_NFT_ADDRESS as `0x${string}`,
      abi: getReceiptAbi,
      functionName: "getReceipt",
      args: [tokenId],
    })) as Receipt;
  } catch (err) {
    console.error("getReceipt failed", String(err));
    return notFound("receipt not found");
  }

  const idStr = tokenId.toString();
  const svg = renderSvg(idStr, r);
  const imageDataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

  const json = {
    name: `POP Receipt #${idStr}`,
    description:
      `Soulbound proof-of-purchase receipt issued by Proof of Purpose. ` +
      `Champion: ${escapeJsonText(r.championName)} | Vendor: ${escapeJsonText(r.vendorName)}.`,
    image: imageDataUrl,
    external_url: `https://basescan.org/token/${RECEIPT_NFT_ADDRESS}?a=${idStr}`,
    attributes: [
      { trait_type: "Champion", value: escapeJsonText(r.championName) },
      { trait_type: "Vendor", value: escapeJsonText(r.vendorName) },
      { trait_type: "USDC", display_type: "number", value: Number(fmtUSDC(r.usdcAmount)) },
      { trait_type: "PURPOSE", display_type: "number", value: Number(fmtPURPOSE(r.purposeAmount)) },
      { trait_type: "Settled At", display_type: "date", value: Number(r.settledAt) },
      { trait_type: "Soulbound", value: "true" },
    ],
  };

  return new Response(JSON.stringify(json), {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
});

// Deterministic generative SVG preview for monthly membership NFTs.
// Same seed (donor_wallet + monthKey) => same art, mirroring on-chain tokenURI.

const PALETTES: Record<number, [string, string, string]> = {
  // monthIndex 1-12 → palette
  1: ["#0b1d3a", "#3b82f6", "#e0f2fe"],
  2: ["#3a0b2a", "#ec4899", "#fce7f3"],
  3: ["#0b3a1d", "#10b981", "#d1fae5"],
  4: ["#3a280b", "#f59e0b", "#fef3c7"],
  5: ["#1a0b3a", "#8b5cf6", "#ede9fe"],
  6: ["#3a0b0b", "#ef4444", "#fee2e2"],
  7: ["#0b3a3a", "#06b6d4", "#cffafe"],
  8: ["#3a3a0b", "#eab308", "#fef9c3"],
  9: ["#1f0b3a", "#a855f7", "#f3e8ff"],
  10: ["#3a1d0b", "#f97316", "#ffedd5"],
  11: ["#0b3a2a", "#14b8a6", "#ccfbf1"],
  12: ["#1d1d3a", "#6366f1", "#e0e7ff"],
};

function hash32(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed: number) {
  let s = seed || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

export function monthLabel(monthKey: number): string {
  const y = Math.floor(monthKey / 100);
  const m = monthKey % 100;
  const names = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
  return `${names[m - 1] ?? "???"} ${y}`;
}

export function membershipSvg(donorWallet: string, monthKey: number, size = 320): string {
  const monthIdx = monthKey % 100;
  const [bg, accent, light] = PALETTES[monthIdx] ?? PALETTES[1];
  const seed = hash32(`${donorWallet.toLowerCase()}|${monthKey}`);
  const rand = rng(seed);

  // 5 generative orbs
  const orbs = Array.from({ length: 5 }, () => ({
    cx: 20 + rand() * 280,
    cy: 40 + rand() * 200,
    r: 20 + rand() * 60,
    fill: rand() > 0.5 ? accent : light,
    o: 0.35 + rand() * 0.5,
  }));

  const ringR = 110 + rand() * 20;
  const motifSides = 3 + Math.floor(rand() * 5); // 3-7
  const cx = 160, cy = 160;
  const points = Array.from({ length: motifSides }, (_, i) => {
    const a = (i / motifSides) * Math.PI * 2 - Math.PI / 2;
    return `${(cx + Math.cos(a) * ringR).toFixed(1)},${(cy + Math.sin(a) * ringR).toFixed(1)}`;
  }).join(" ");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320" width="${size}" height="${size}">
    <rect width="320" height="320" fill="${bg}"/>
    ${orbs.map(o => `<circle cx="${o.cx.toFixed(1)}" cy="${o.cy.toFixed(1)}" r="${o.r.toFixed(1)}" fill="${o.fill}" opacity="${o.o.toFixed(2)}"/>`).join("")}
    <polygon points="${points}" fill="none" stroke="${light}" stroke-width="2" opacity="0.85"/>
    <circle cx="160" cy="160" r="60" fill="${accent}" opacity="0.9"/>
    <text x="160" y="166" text-anchor="middle" font-family="monospace" font-size="14" font-weight="700" fill="${bg}">PURPOSE</text>
    <text x="160" y="295" text-anchor="middle" font-family="monospace" font-size="13" fill="${light}" letter-spacing="2">${monthLabel(monthKey)}</text>
  </svg>`;
}

export function membershipDataUri(donorWallet: string, monthKey: number, size = 320): string {
  const svg = membershipSvg(donorWallet, monthKey, size);
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function currentMonthKey(d = new Date()): number {
  return d.getUTCFullYear() * 100 + (d.getUTCMonth() + 1);
}

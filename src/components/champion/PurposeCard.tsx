import { useEffect, useMemo, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useActiveAccount } from "thirdweb/react";
import { Eye, EyeOff, Copy, QrCode, RotateCw, Check } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { formatPurpose, usePurposeBalance } from "@/hooks/usePurposeBalance";
import { toast } from "sonner";
import popLogo from "@/assets/pop-logo.png";

interface Props {
  address: string;
  onShowQR?: () => void;
}

type Variant = "obsidian" | "aurora" | "signal";

const VARIANTS: { id: Variant; label: string }[] = [
  { id: "obsidian", label: "OBSIDIAN" },
  { id: "aurora", label: "AURORA" },
  { id: "signal", label: "SIGNAL" },
];

function variantFace(v: Variant): React.CSSProperties {
  switch (v) {
    case "obsidian":
      return {
        background:
          "radial-gradient(120% 80% at 0% 0%, hsl(60 100% 50% / 0.18), transparent 55%), radial-gradient(120% 80% at 100% 100%, hsl(60 100% 50% / 0.08), transparent 50%), linear-gradient(135deg, hsl(0 0% 6%), hsl(0 0% 10%) 60%, hsl(0 0% 4%))",
      };
    case "aurora":
      return {
        background:
          "radial-gradient(130% 90% at 20% 10%, hsl(280 60% 35% / 0.7), transparent 55%), radial-gradient(120% 90% at 90% 90%, hsl(190 90% 45% / 0.55), transparent 55%), linear-gradient(140deg, hsl(240 30% 8%), hsl(220 35% 12%))",
      };
    case "signal":
      return {
        background:
          "linear-gradient(140deg, hsl(60 100% 50%), hsl(54 100% 45%) 60%, hsl(45 100% 40%))",
      };
  }
}

function textColor(v: Variant) {
  return v === "signal" ? "text-foreground" : "text-background";
}
function subText(v: Variant) {
  return v === "signal" ? "text-foreground/60" : "text-background/60";
}
function accent(v: Variant) {
  return v === "signal" ? "text-foreground" : "text-primary";
}

export function PurposeCard({ address, onShowQR }: Props) {
  const account = useActiveAccount();
  const { data: balance, isLoading } = usePurposeBalance(address);
  const [variant, setVariant] = useState<Variant>("obsidian");
  const [flipped, setFlipped] = useState(false);
  const [showFull, setShowFull] = useState(false);
  const [copied, setCopied] = useState(false);
  const [displayName, setDisplayName] = useState<string>("");
  const [qrPayload, setQrPayload] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);

  // pointer-driven 3D tilt
  const cardRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0, glareX: 50, glareY: 50 });

  const last4 = address ? address.slice(-4).toUpperCase() : "----";
  const short = address
    ? `${address.slice(0, 6)}…${address.slice(-4)}`
    : "----";

  // fetch display name
  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const { data } = await supabase
        .from("profiles")
        .select("display_name,username")
        .eq("id", auth.user.id)
        .maybeSingle();
      const name = (data?.display_name || data?.username || "").trim();
      if (name) setDisplayName(name);
    })();
  }, [address]);

  const [signing, setSigning] = useState(false);

  async function generateQr() {
    if (!account || signing) return;
    setSigning(true);
    setQrError(null);
    try {
      const expiresAt = Date.now() + 5 * 60 * 1000;
      const message = `pop-redeem:${account.address}:${expiresAt}`;
      const signature = await account.signMessage({ message });
      setQrPayload(
        JSON.stringify({
          wallet: account.address,
          expires_at: expiresAt,
          signature,
        }),
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to sign";
      // User-rejected MetaMask popup → friendly copy
      setQrError(
        /reject|denied|cancel/i.test(msg)
          ? "Signature cancelled. Tap GENERATE to try again."
          : msg,
      );
    } finally {
      setSigning(false);
    }
  }

  // Reset QR when flipped back to front so each redeem session is fresh
  useEffect(() => {
    if (!flipped) {
      setQrPayload(null);
      setQrError(null);
    }
  }, [flipped]);

  function onPointerMove(e: React.PointerEvent) {
    const el = cardRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    const ry = (x - 0.5) * 18; // left/right tilt
    const rx = (0.5 - y) * 14; // up/down tilt
    setTilt({ rx, ry, glareX: x * 100, glareY: y * 100 });
  }
  function onPointerLeave() {
    setTilt({ rx: 0, ry: 0, glareX: 50, glareY: 50 });
  }

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      toast.success("Address copied");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Copy failed");
    }
  }

  const cardholder = useMemo(
    () => (displayName || "MEMBER").toUpperCase(),
    [displayName],
  );

  const faceStyle = variantFace(variant);

  return (
    <div className="space-y-4">
      {/* 3D scene */}
      <div
        className="relative mx-auto w-full max-w-md"
        style={{ perspective: "1400px" }}
      >
        <div
          ref={cardRef}
          onPointerMove={onPointerMove}
          onPointerLeave={onPointerLeave}
          className="relative aspect-[1.586/1] w-full transition-transform duration-500 ease-out"
          style={{
            transformStyle: "preserve-3d",
            transform: `rotateY(${flipped ? 180 : 0}deg) rotateX(${tilt.rx}deg) rotateY(${(flipped ? 180 : 0) + tilt.ry}deg)`,
          }}
        >
          {/* FRONT */}
          <div
            className="absolute inset-0 overflow-hidden rounded-2xl border border-foreground/10 p-5 sm:p-6"
            style={{
              ...faceStyle,
              backfaceVisibility: "hidden",
              boxShadow:
                "0 30px 60px -20px hsl(0 0% 0% / 0.7), 0 10px 25px -10px hsl(0 0% 0% / 0.5), inset 0 1px 0 hsl(0 0% 100% / 0.08)",
            }}
          >
            {/* glare layer */}
            <div
              className="pointer-events-none absolute inset-0 mix-blend-overlay"
              style={{
                background: `radial-gradient(280px circle at ${tilt.glareX}% ${tilt.glareY}%, hsl(0 0% 100% / 0.35), transparent 60%)`,
              }}
            />
            {/* sheen edge */}
            <div
              className="pointer-events-none absolute inset-0 rounded-2xl"
              style={{
                background:
                  "linear-gradient(135deg, hsl(0 0% 100% / 0.08), transparent 35%)",
              }}
            />

            <div className="relative flex h-full flex-col justify-between">
              {/* top row */}
              <div className="flex items-start justify-between">
                <div>
                  <p
                    className={`font-mono text-[10px] uppercase tracking-[0.25em] ${subText(variant)}`}
                  >
                    proof of purpose
                  </p>
                  <p
                    className={`mt-1 font-display text-xl ${accent(variant)}`}
                  >
                    $PURPOSE
                  </p>
                </div>
                {/* chip */}
                <div
                  className="h-9 w-12 rounded-md"
                  style={{
                    background:
                      variant === "signal"
                        ? "linear-gradient(135deg, hsl(40 40% 60%), hsl(45 60% 45%))"
                        : "linear-gradient(135deg, hsl(48 80% 65%), hsl(40 70% 40%))",
                    boxShadow:
                      "inset 0 0 0 1px hsl(0 0% 0% / 0.3), inset 0 -2px 4px hsl(0 0% 0% / 0.25)",
                  }}
                >
                  <div className="m-1.5 grid h-6 w-9 grid-cols-3 grid-rows-2 gap-px opacity-50">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div
                        key={i}
                        className="rounded-[1px] bg-foreground/60"
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* balance */}
              <div>
                {isLoading ? (
                  <Skeleton
                    className={`h-10 w-40 ${variant === "signal" ? "bg-foreground/15" : "bg-background/15"}`}
                  />
                ) : (
                  <p
                    className={`font-display text-4xl sm:text-5xl ${textColor(variant)}`}
                  >
                    {formatPurpose(balance)}
                    <span
                      className={`ml-2 text-base font-display ${accent(variant)}`}
                    >
                      $P
                    </span>
                  </p>
                )}
                {/* address */}
                <button
                  onClick={() => setShowFull((s) => !s)}
                  className={`mt-3 inline-flex items-center gap-1.5 font-mono text-[11px] sm:text-xs tracking-[0.18em] ${subText(variant)} hover:opacity-80`}
                  title={showFull ? "Hide address" : "Show address"}
                >
                  <span className={textColor(variant)}>
                    {showFull
                      ? address
                      : `•••• •••• •••• ${last4}`}
                  </span>
                  {showFull ? (
                    <EyeOff className="h-3.5 w-3.5" />
                  ) : (
                    <Eye className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>

              {/* bottom row */}
              <div className="flex items-end justify-between">
                <div>
                  <p
                    className={`font-mono text-[9px] uppercase tracking-[0.25em] ${subText(variant)}`}
                  >
                    cardholder
                  </p>
                  <p
                    className={`font-display text-sm ${textColor(variant)}`}
                  >
                    {cardholder}
                  </p>
                </div>
                <div className="text-right">
                  <p
                    className={`font-mono text-[9px] uppercase tracking-[0.25em] ${subText(variant)}`}
                  >
                    network
                  </p>
                  <p
                    className={`font-display text-sm ${accent(variant)}`}
                  >
                    POP • BASE
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* BACK — QR */}
          <div
            className="absolute inset-0 overflow-hidden rounded-2xl border border-foreground/10 p-5 sm:p-6"
            style={{
              ...faceStyle,
              backfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
              boxShadow:
                "0 30px 60px -20px hsl(0 0% 0% / 0.7), 0 10px 25px -10px hsl(0 0% 0% / 0.5), inset 0 1px 0 hsl(0 0% 100% / 0.08)",
            }}
          >
            <div className="relative flex h-full flex-col items-center justify-between">
              <div className="flex w-full items-center justify-between">
                <p
                  className={`font-mono text-[10px] uppercase tracking-[0.25em] ${subText(variant)}`}
                >
                  scan to redeem
                </p>
                <p
                  className={`font-mono text-[10px] uppercase tracking-[0.25em] ${subText(variant)}`}
                >
                  {qrPayload ? "expires 5:00" : "tap to generate"}
                </p>
              </div>

              <div className="flex flex-col items-center gap-3">
                <div className="rounded-xl bg-white p-2 shadow-2xl">
                  {qrPayload ? (
                    <QRCodeSVG
                      value={qrPayload}
                      size={150}
                      level="L"
                      bgColor="#ffffff"
                      fgColor="#000000"
                    />
                  ) : (
                    <button
                      onClick={generateQr}
                      disabled={signing}
                      className="flex h-[150px] w-[150px] flex-col items-center justify-center gap-2 bg-foreground text-background hover:bg-foreground/90 disabled:opacity-60"
                    >
                      <QrCode className="h-8 w-8 text-primary" />
                      <span className="font-display text-xs">
                        {signing ? "SIGNING…" : "GENERATE"}
                      </span>
                    </button>
                  )}
                </div>
                {qrError && (
                  <p
                    className={`max-w-[200px] text-center font-mono text-[10px] uppercase tracking-wider ${variant === "signal" ? "text-foreground/80" : "text-background/80"}`}
                  >
                    {qrError}
                  </p>
                )}
              </div>

              <p
                className={`font-mono text-[10px] uppercase tracking-[0.25em] ${subText(variant)}`}
              >
                {cardholder} • {last4}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* action row */}
      <div className="mx-auto flex max-w-md items-center justify-between gap-2">
        <button
          onClick={() => {
            setFlipped((f) => !f);
            onShowQR?.();
          }}
          className="brutal-primary brutal-hover flex flex-1 items-center justify-center gap-2 px-4 py-3 font-display text-sm"
        >
          {flipped ? (
            <>
              <RotateCw className="h-4 w-4" /> SHOW CARD
            </>
          ) : (
            <>
              <QrCode className="h-4 w-4" /> REDEEM QR
            </>
          )}
        </button>
        <button
          onClick={copyAddress}
          className="brutal brutal-hover flex items-center justify-center gap-2 px-4 py-3 font-display text-sm"
          title="Copy full address"
        >
          {copied ? (
            <Check className="h-4 w-4" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* variant picker */}
      <div className="mx-auto flex max-w-md items-center justify-center gap-2 pt-1">
        {VARIANTS.map((v) => (
          <button
            key={v.id}
            onClick={() => setVariant(v.id)}
            className={`border-2 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] transition-colors ${
              variant === v.id
                ? "border-primary bg-primary text-primary-foreground"
                : "border-foreground/20 text-muted-foreground hover:border-foreground/50"
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>
    </div>
  );
}

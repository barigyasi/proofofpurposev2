import { useEffect, useMemo, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useActiveAccount } from "thirdweb/react";
import { Eye, EyeOff, Copy, QrCode, Check, Sparkles } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { formatPurpose, usePurposeBalance } from "@/hooks/usePurposeBalance";
import { toast } from "sonner";
import popLogo from "@/assets/pop-logo.png";
import { useCardTheme } from "@/context/CardThemeContext";

interface Props {
  address: string;
  onShowQR?: () => void;
}

type Variant = "obsidian" | "aurora" | "signal";

const VARIANTS: { id: Variant; label: string; strap: string }[] = [
  { id: "obsidian", label: "OBSIDIAN", strap: "Stealth metal" },
  { id: "aurora", label: "AURORA", strap: "Night light" },
  { id: "signal", label: "SIGNAL", strap: "High contrast" },
];

function variantStyles(variant: Variant) {
  switch (variant) {
    case "obsidian":
      return {
        // LIGHT: soft pearl/graphite card with ink type. DARK: original near-black obsidian.
        shell:
          "border-black/10 text-[hsl(0_0%_8%)] bg-[radial-gradient(circle_at_top_left,hsl(60_100%_50%/0.22),transparent_34%),radial-gradient(circle_at_bottom_right,hsl(0_0%_0%/0.08),transparent_38%),linear-gradient(145deg,hsl(0_0%_98%),hsl(0_0%_92%)_52%,hsl(0_0%_86%))] " +
          "dark:border-white/10 dark:text-foreground dark:bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.16),transparent_34%),radial-gradient(circle_at_bottom_right,hsl(var(--foreground)/0.08),transparent_38%),linear-gradient(145deg,hsl(0_0%_6%),hsl(0_0%_9%)_52%,hsl(0_0%_4%))]",
        accent: "text-[hsl(0_0%_8%)] dark:text-primary",
        sub: "text-black/55 dark:text-foreground/60",
        line: "border-black/10 dark:border-white/10",
        pill: "bg-black/5 text-black/65 border-black/10 dark:bg-white/6 dark:text-foreground/72 dark:border-white/10",
        innerPanel: "bg-white/55 dark:bg-black/10",
        qrFrame: "border-black/10 bg-white dark:border-white/10 dark:bg-white/95",
        halo:
          "bg-[radial-gradient(circle_at_18%_20%,hsl(60_100%_50%/0.22),transparent_0_36%),radial-gradient(circle_at_82%_78%,hsl(0_0%_0%/0.06),transparent_0_36%)] " +
          "dark:bg-[radial-gradient(circle_at_18%_20%,hsl(var(--primary)/0.18),transparent_0_36%),radial-gradient(circle_at_82%_78%,hsl(var(--foreground)/0.08),transparent_0_36%)]",
        innerBorder: "border-black/5 dark:border-white/10",
      };
    case "aurora":
      return {
        // LIGHT: pastel lavender→sky aurora. DARK: deep indigo/violet w/ neon halos.
        shell:
          "border-black/10 text-[hsl(244_40%_18%)] bg-[radial-gradient(circle_at_15%_15%,hsl(286_82%_72%/0.55),transparent_36%),radial-gradient(circle_at_86%_78%,hsl(188_92%_72%/0.5),transparent_38%),linear-gradient(150deg,hsl(250_100%_97%),hsl(220_100%_96%)_50%,hsl(290_100%_96%))] " +
          "dark:border-white/10 dark:text-foreground dark:bg-[radial-gradient(circle_at_15%_15%,hsl(286_72%_52%/0.34),transparent_32%),radial-gradient(circle_at_86%_78%,hsl(188_92%_50%/0.26),transparent_34%),linear-gradient(150deg,hsl(244_34%_10%),hsl(223_40%_11%)_50%,hsl(0_0%_5%))]",
        accent: "text-[hsl(286_72%_42%)] dark:text-primary",
        sub: "text-[hsl(244_30%_30%)]/70 dark:text-foreground/68",
        line: "border-black/10 dark:border-white/10",
        pill: "bg-white/60 text-[hsl(244_30%_25%)] border-black/10 dark:bg-white/8 dark:text-foreground/80 dark:border-white/10",
        innerPanel: "bg-white/55 dark:bg-black/10",
        qrFrame: "border-black/10 bg-white dark:border-white/10 dark:bg-white/95",
        halo:
          "bg-[radial-gradient(circle_at_12%_18%,hsl(286_82%_72%/0.4),transparent_0_36%),radial-gradient(circle_at_88%_82%,hsl(188_92%_70%/0.32),transparent_0_38%)] " +
          "dark:bg-[radial-gradient(circle_at_12%_18%,hsl(286_72%_52%/0.28),transparent_0_34%),radial-gradient(circle_at_88%_82%,hsl(188_92%_50%/0.2),transparent_0_36%)]",
        innerBorder: "border-black/5 dark:border-white/10",
      };
    case "signal":
      return {
        // SIGNAL is intentionally hi-vis in both modes; light variant slightly softer.
        shell:
          "border-black/70 text-[hsl(0_0%_6%)] bg-[radial-gradient(circle_at_top_left,hsl(0_0%_0%/0.06),transparent_32%),linear-gradient(150deg,hsl(60_100%_60%),hsl(55_100%_55%)_58%,hsl(49_100%_50%))] " +
          "dark:border-primary/60 dark:text-background dark:bg-[radial-gradient(circle_at_top_left,hsl(var(--foreground)/0.07),transparent_32%),linear-gradient(150deg,hsl(60_100%_50%),hsl(55_100%_47%)_58%,hsl(49_100%_43%))]",
        accent: "text-[hsl(0_0%_6%)] dark:text-background",
        sub: "text-black/70 dark:text-background/72",
        line: "border-black/25 dark:border-background/20",
        pill: "bg-black/10 text-black/75 border-black/20 dark:bg-background/10 dark:text-background/78 dark:border-background/15",
        innerPanel: "bg-black/5 dark:bg-black/10",
        qrFrame: "border-black/20 bg-white dark:border-background/15 dark:bg-white",
        halo:
          "bg-[radial-gradient(circle_at_16%_20%,hsl(0_0%_0%/0.08),transparent_0_34%),radial-gradient(circle_at_84%_78%,hsl(0_0%_100%/0.4),transparent_0_36%)] " +
          "dark:bg-[radial-gradient(circle_at_16%_20%,hsl(var(--foreground)/0.08),transparent_0_34%),radial-gradient(circle_at_84%_78%,hsl(var(--background)/0.18),transparent_0_36%)]",
        innerBorder: "border-black/10 dark:border-white/10",
      };
  }
}

function formatAddress(address: string, showFull: boolean) {
  if (!address) return "•••• •••• •••• ----";
  return showFull ? address : `•••• •••• •••• ${address.slice(-4).toUpperCase()}`;
}

export function PurposeCard({ address, onShowQR }: Props) {
  const account = useActiveAccount();
  const { data: balance, isLoading } = usePurposeBalance(address);
  const { theme: variant, setTheme: setVariant } = useCardTheme();
  const [showFull, setShowFull] = useState(false);
  const [copied, setCopied] = useState(false);
  const [displayName, setDisplayName] = useState<string>("");
  const [qrOpen, setQrOpen] = useState(false);
  const [qrPayload, setQrPayload] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0, glareX: 50, glareY: 50 });

  const activeVariant = variantStyles(variant);
  const last4 = address ? address.slice(-4).toUpperCase() : "----";

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

  useEffect(() => {
    if (!qrOpen) {
      setQrPayload(null);
      setQrError(null);
      setSigning(false);
    }
  }, [qrOpen]);

  const cardholder = useMemo(
    () => (displayName || "MEMBER").toUpperCase(),
    [displayName],
  );

  function onPointerMove(e: React.PointerEvent) {
    const el = cardRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    setTilt({
      rx: (0.5 - y) * 12,
      ry: (x - 0.5) * 16,
      glareX: x * 100,
      glareY: y * 100,
    });
  }

  function onPointerLeave() {
    setTilt({ rx: 0, ry: 0, glareX: 50, glareY: 50 });
  }

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      toast.success("Address copied");
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Copy failed");
    }
  }

  async function openRedeemQR() {
    if (!account || signing) return;
    setQrOpen(true);
    setSigning(true);
    setQrError(null);

    const expiresAt = Date.now() + 5 * 60 * 1000;
    const message = `pop-redeem:${account.address}:${expiresAt}`;
    const basePayload = {
      wallet: account.address,
      expires_at: expiresAt,
    };

    try {
      const signature = await account.signMessage({ message });
      setQrPayload(JSON.stringify({ ...basePayload, signature }));
      onShowQR?.();
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to generate QR";
      setQrError(/reject|denied|cancel/i.test(msg) ? "Signature cancelled." : msg);
    } finally {
      setSigning(false);
    }
  }

  return (
    <>
      <div className="space-y-4">
        <div className="relative mx-auto w-full max-w-md" style={{ perspective: "1400px" }}>
          <div
            ref={cardRef}
            onPointerMove={onPointerMove}
            onPointerLeave={onPointerLeave}
            className="relative aspect-[1.586/1] w-full transition-transform duration-300 ease-out"
            style={{
              transformStyle: "preserve-3d",
              transform: `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
            }}
          >
            <div
              className={`absolute inset-0 overflow-hidden rounded-[28px] border p-5 shadow-[0_32px_80px_-32px_hsl(0_0%_0%/0.9)] sm:p-6 ${activeVariant.shell}`}
            >
              <div className={`pointer-events-none absolute inset-0 ${activeVariant.halo}`} />
              <div
                className="pointer-events-none absolute inset-0 opacity-80 mix-blend-screen"
                style={{
                  background: `radial-gradient(300px circle at ${tilt.glareX}% ${tilt.glareY}%, hsl(0 0% 100% / 0.22), transparent 60%)`,
                }}
              />
              <div className={`pointer-events-none absolute inset-[1px] rounded-[27px] border ${activeVariant.innerBorder}`} />

              <div className="relative flex h-full flex-col justify-between">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2">
                    <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.24em] ${activeVariant.pill}`}>
                      <Sparkles className="h-3 w-3" />
                      PURPOSE
                    </div>
                    <div>
                      <p className={`font-mono text-[10px] uppercase tracking-[0.24em] ${activeVariant.sub}`}>
                        spend balance
                      </p>
                      {isLoading ? (
                        <Skeleton className="mt-2 h-11 w-40 bg-white/10" />
                      ) : (
                        <p className={`mt-2 font-display text-[42px] leading-none ${activeVariant.accent}`}>
                          {formatPurpose(balance)}
                          <span className="ml-2 text-base">$P</span>
                        </p>
                      )}
                    </div>
                  </div>

                  <div className={`flex h-12 w-12 items-center justify-center rounded-2xl border p-2 backdrop-blur-sm ${activeVariant.innerBorder} ${activeVariant.innerPanel}`}>
                    <img src={popLogo} alt="POP" className="h-full w-full object-contain" />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className={`rounded-2xl border p-4 backdrop-blur-sm ${activeVariant.line} ${activeVariant.innerPanel}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className={`font-mono text-[10px] uppercase tracking-[0.24em] ${activeVariant.sub}`}>
                          cardholder
                        </p>
                        <p className="mt-2 break-words font-display text-lg leading-none">
                          {cardholder}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={`font-mono text-[10px] uppercase tracking-[0.24em] ${activeVariant.sub}`}>
                          wallet
                        </p>
                        <button
                          onClick={() => setShowFull((s) => !s)}
                          className="mt-2 inline-flex items-center gap-1.5 font-mono text-[11px] tracking-[0.14em]"
                          title={showFull ? "Hide address" : "Show address"}
                        >
                          <span>{formatAddress(address, showFull)}</span>
                          {showFull ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <p className={`font-mono text-[10px] uppercase tracking-[0.24em] ${activeVariant.sub}`}>
                        network
                      </p>
                      <p className="mt-2 font-display text-base leading-none">POP • BASE</p>
                    </div>
                    <div className="text-right">
                      <p className={`font-mono text-[10px] uppercase tracking-[0.24em] ${activeVariant.sub}`}>
                        ending
                      </p>
                      <p className="mt-2 font-display text-base leading-none">••{last4}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mx-auto flex max-w-md items-center justify-between gap-2">
          <button
            onClick={openRedeemQR}
            disabled={!account || signing}
            className="brutal-primary brutal-hover flex flex-1 items-center justify-center gap-2 px-4 py-3 font-display text-sm disabled:opacity-60"
          >
            <QrCode className="h-4 w-4" />
            {signing ? "GENERATING…" : "REDEEM QR"}
          </button>
          <button
            onClick={copyAddress}
            className="brutal brutal-hover flex items-center justify-center gap-2 px-4 py-3 font-display text-sm"
            title="Copy full address"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>

        <div className="mx-auto grid max-w-md grid-cols-3 gap-2 pt-1">
          {VARIANTS.map((item) => (
            <button
              key={item.id}
              onClick={() => setVariant(item.id)}
              className={`rounded-2xl border px-3 py-2 text-left transition-colors ${
                variant === item.id
                  ? "border-primary bg-primary/12 text-foreground"
                  : "border-border bg-card text-muted-foreground hover:border-foreground/40"
              }`}
            >
              <p className="font-display text-xs leading-none">{item.label}</p>
              <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.18em]">{item.strap}</p>
            </button>
          ))}
        </div>
      </div>

      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="max-w-md border-border bg-card p-0 text-card-foreground overflow-hidden">
          <div className={`relative border-b p-6 ${activeVariant.shell}`}>
            <div className={`pointer-events-none absolute inset-0 ${activeVariant.halo}`} />
            <DialogHeader className="relative pr-10 text-left">
              <DialogTitle className="font-display text-3xl leading-none">REDEEM QR</DialogTitle>
              <DialogDescription className={`mt-2 max-w-[26ch] font-mono text-[11px] uppercase tracking-[0.18em] ${activeVariant.sub}`}>
                Show this code to the vendor terminal for VendorRedemptionV2.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="space-y-4 p-6">
            <div className="flex justify-center">
              <div className={`rounded-[24px] border p-3 shadow-[0_18px_50px_-26px_hsl(0_0%_0%/0.8)] ${activeVariant.qrFrame}`}>
                {qrPayload ? (
                  <QRCodeSVG
                    value={qrPayload}
                    size={280}
                    level="L"
                    bgColor="#ffffff"
                    fgColor="#000000"
                    includeMargin
                  />
                ) : signing ? (
                  <Skeleton className="h-[280px] w-[280px] bg-black/10" />
                ) : (
                  <div className="flex h-[280px] w-[280px] items-center justify-center bg-white text-center font-mono text-xs uppercase tracking-[0.18em] text-black/65">
                    Waiting for signature
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2 text-center">
              <p className="font-display text-lg leading-none">{cardholder}</p>
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                {address}
              </p>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                Expires in 5 minutes after generation
              </p>
              {qrError ? (
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-destructive">
                  {qrError}
                </p>
              ) : null}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
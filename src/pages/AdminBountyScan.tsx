import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Html5Qrcode } from "html5-qrcode";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSessionRoles } from "@/hooks/useSessionRoles";
import { useBountyAdmin } from "@/hooks/useBountyAdmin";
import { useBounties } from "@/hooks/useBounties";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useParticipantNames } from "@/hooks/useParticipantNames";
import { ParticipantLabel } from "@/components/ParticipantLabel";

export default function AdminBountyScan() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { session, roles, isLoading } = useSessionRoles();
  const { data: bounties } = useBounties();
  const { checkInParticipant, busy } = useBountyAdmin();
  const qc = useQueryClient();
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [scanning, setScanning] = useState(false);
  const [last, setLast] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<{ wallet: string; at: number } | null>(null);
  const [manualWallet, setManualWallet] = useState("");

  const bounty = bounties?.find((b) => b.id === id);

  const { data: signups, refetch: refetchSignups } = useQuery({
    queryKey: ["bounty-signups", id],
    enabled: !!id,
    refetchInterval: 5000,
    queryFn: async () => {
      const { data } = await supabase
        .from("bounty_signups")
        .select("id,wallet_address,user_id,status,checked_in_at")
        .eq("bounty_id", id!)
        .order("created_at", { ascending: true });
      return data ?? [];
    },
  });

  const checkedInCount = (signups ?? []).filter(
    (s) => s.status === "checked_in" || s.status === "added",
  ).length;
  const totalCount = signups?.length ?? 0;
  const names = useParticipantNames(signups ?? []);

  useEffect(() => {
    if (isLoading) return;
    if (!session) navigate("/login", { replace: true });
    else if (!roles.includes("admin")) navigate("/dashboard", { replace: true });
  }, [isLoading, session, roles, navigate]);

  useEffect(() => {
    return () => {
      scannerRef.current?.stop().catch(() => {});
      scannerRef.current?.clear();
    };
  }, []);

  async function start() {
    if (!id) return;
    setScanning(true);
    const scanner = new Html5Qrcode("scanner-region");
    scannerRef.current = scanner;
    try {
      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 15,
          aspectRatio: 1.0,
          qrbox: (w: number, h: number) => {
            const min = Math.min(w, h);
            const size = Math.floor(min * 0.75);
            return { width: size, height: size };
          },
          // @ts-expect-error - experimentalFeatures is supported but not in older type defs
          experimentalFeatures: { useBarCodeDetectorIfSupported: true },
        },
        async (decoded) => {
          try {
            const data = JSON.parse(decoded);
            if (data.t !== "checkin" || data.bountyId !== id) {
              toast.error("QR is not for this event");
              return;
            }
            if (last === data.walletAddress) return;
            setLast(data.walletAddress);
            try {
              await checkInParticipant(id, data.walletAddress);
              setConfirmed({ wallet: data.walletAddress, at: Date.now() });
              await refetchSignups();
              await qc.invalidateQueries({ queryKey: ["bounty-signups"] });
            } catch {
              setLast(null); // allow retry
            }
          } catch {
            toast.error("Bad QR");
          }
        },
        () => {},
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Camera failed");
      setScanning(false);
    }
  }

  async function stop() {
    await scannerRef.current?.stop().catch(() => {});
    scannerRef.current?.clear();
    setScanning(false);
  }

  if (isLoading || !roles.includes("admin")) return null;

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <div className="border-b-2 border-foreground pb-6">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          // admin · check-in
        </p>
        <h1 className="mt-2 font-display text-4xl">{bounty?.name ?? "EVENT"}</h1>
        <p className="mt-1 font-mono text-xs text-muted-foreground">
          status: {bounty?.status.toUpperCase()} · checked in: <span className="text-primary">{checkedInCount}</span> / {totalCount}
        </p>
      </div>

      {confirmed && Date.now() - confirmed.at < 8000 && (
        <div className="mt-4 border-2 border-primary bg-primary/10 p-3">
          <p className="font-display text-lg text-primary">✓ CHECKED IN</p>
          <ParticipantLabel
            wallet={confirmed.wallet}
            name={names.get(confirmed.wallet.toLowerCase())}
          />
        </div>
      )}

      <div className="mt-6 brutal p-4">
        <div id="scanner-region" className="mx-auto w-full max-w-md" />
        <div className="mt-4 flex gap-2">
          {!scanning ? (
            <Button onClick={start} disabled={busy} className="brutal-primary brutal-hover font-display">
              START SCANNING
            </Button>
          ) : (
            <Button onClick={stop} variant="outline">STOP</Button>
          )}
          <Button variant="ghost" onClick={() => navigate("/admin/bounties")}>BACK</Button>
        </div>
        {last && (
          <p className="mt-3 font-mono text-xs text-muted-foreground">
            last scanned: <span className="text-primary">{last}</span>
          </p>
        )}
      </div>

      <div className="mt-6 brutal p-4">
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          // manual check-in fallback
        </p>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <Input
            value={manualWallet}
            onChange={(e) => setManualWallet(e.target.value.trim())}
            placeholder="0x… champion wallet"
            className="font-mono text-xs"
          />
          <Button
            disabled={busy || !/^0x[a-fA-F0-9]{40}$/.test(manualWallet) || !id}
            onClick={async () => {
              if (!id) return;
              try {
                await checkInParticipant(id, manualWallet);
                setConfirmed({ wallet: manualWallet, at: Date.now() });
                setManualWallet("");
                await refetchSignups();
                await qc.invalidateQueries({ queryKey: ["bounty-signups"] });
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Failed");
              }
            }}
            className="brutal-primary brutal-hover font-display"
          >
            {busy ? "…" : "CHECK IN"}
          </Button>
        </div>
      </div>
    </main>
  );
}

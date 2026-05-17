import { useEffect, useMemo, useState } from "react";
import { useActiveAccount } from "thirdweb/react";
import { MembershipsStrip } from "@/components/membership/MembershipsStrip";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PurposeCard } from "@/components/champion/PurposeCard";
import { RedeemQRDialog } from "@/components/champion/RedeemQRDialog";
import { CheckInQRDialog } from "@/components/champion/CheckInQRDialog";
import { SectionDivider } from "@/components/champion/SectionDivider";
import { BountyCard } from "@/components/bounties/BountyCard";
import { BountyDetailsDialog } from "@/components/bounties/BountyDetailsDialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useBounties, type Bounty } from "@/hooks/useBounties";
import { ChampionChargeWatcher } from "@/components/champion/ChampionChargeWatcher";
import { ChampionReceiptsStrip } from "@/components/champion/ChampionReceiptsStrip";
import { V2StatusBanner } from "@/components/V2StatusBanner";

type SignupRow = { bounty_id: string; status: string };

export function ChampionDashboard() {
  const account = useActiveAccount();
  const qc = useQueryClient();
  const { data: bounties, isLoading } = useBounties();
  const [qrOpen, setQrOpen] = useState(false);
  const [details, setDetails] = useState<Bounty | null>(null);
  const [signingUp, setSigningUp] = useState<string | null>(null);
  const [signups, setSignups] = useState<SignupRow[]>([]);
  const [checkInBounty, setCheckInBounty] = useState<Bounty | null>(null);

  const wallet = account?.address.toLowerCase() ?? "";

  useEffect(() => {
    if (!wallet) return;
    (async () => {
      const { data } = await supabase
        .from("bounty_signups")
        .select("bounty_id,status")
        .ilike("wallet_address", wallet);
      setSignups(data ?? []);
    })();
  }, [wallet, signingUp]);

  const signupByBounty = useMemo(() => {
    const m = new Map<string, string>();
    signups.forEach((s) => m.set(s.bounty_id, s.status));
    return m;
  }, [signups]);

  const { active, available } = useMemo(() => {
    const a: Bounty[] = [];
    const v: Bounty[] = [];
    for (const b of bounties ?? []) {
      if (b.status === "completed") continue;
      if (signupByBounty.has(b.id)) a.push(b);
      else if (b.status === "open") v.push(b);
    }
    return { active: a, available: v };
  }, [bounties, signupByBounty]);

  async function signUp(bounty: Bounty) {
    if (!account) return;
    setSigningUp(bounty.id);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Enter first");
      const { error } = await supabase.from("bounty_signups").insert({
        bounty_id: bounty.id,
        on_chain_bounty_id: bounty.onChainId,
        user_id: user.id,
        wallet_address: account.address,
      });
      if (error) {
        if (error.code === "23505") throw new Error("You're already signed up");
        throw error;
      }
      toast.success("Signed up — admin will add you on-chain shortly");
      await qc.invalidateQueries({ queryKey: ["bounties"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sign-up failed");
    } finally {
      setSigningUp(null);
    }
  }

  if (!account) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-24 text-center">
        <p className="font-display text-3xl">CONNECT WALLET TO CONTINUE</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <ChampionChargeWatcher />
      <div className="border-b-2 border-foreground pb-6">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          // champion dashboard
        </p>
        <h1 className="mt-3 font-display text-5xl sm:text-7xl">
          WHAT'S<br />
          POPPIN, <span className="text-primary">CHAMP?</span>
        </h1>
      </div>

      <div className="mt-6">
        <V2StatusBanner context="champion" />
      </div>

      <div className="mt-8">
        <PurposeBalanceCard
          address={account.address}
          onShowQR={() => setQrOpen(true)}
        />
      </div>

      <div className="mt-12">
        <SectionDivider label="ACTIVE BOUNTIES" />
        {isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : active.length === 0 ? (
          <p className="py-10 text-center font-mono text-sm text-muted-foreground">
            // no active bounties yet
          </p>
        ) : (
          <div className="space-y-4 pt-2">
            {active.map((b) => {
              const status = signupByBounty.get(b.id);
              return (
                <div key={b.id} className="space-y-2">
                  <BountyCard
                    bounty={b}
                    mode="active"
                    onViewDetails={() => setDetails(b)}
                  />
                  {b.status === "running" && status === "pending" && (
                    <Button
                      onClick={() => setCheckInBounty(b)}
                      className="brutal-primary brutal-hover w-full font-display"
                    >
                      SHOW CHECK-IN CODE
                    </Button>
                  )}
                  {(status === "checked_in" || status === "added") && b.status === "running" && (
                    <p className="border-2 border-primary bg-primary/10 p-2 text-center font-mono text-xs uppercase text-primary">
                      ✓ checked in — reward pending event close
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-12">
        <SectionDivider label="AVAILABLE BOUNTIES" />
        {isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : available.length === 0 ? (
          <p className="py-10 text-center font-mono text-sm text-muted-foreground">
            // nothing available — check back soon
          </p>
        ) : (
          <div className="space-y-4 pt-2">
            {available.map((b) => (
              <BountyCard
                key={b.id}
                bounty={b}
                mode="available"
                signingUp={signingUp === b.id}
                onViewDetails={() => setDetails(b)}
                onSignUp={() => signUp(b)}
              />
            ))}
          </div>
        )}
      </div>

      <MembershipsStrip wallet={account?.address} />

      {account?.address && <ChampionReceiptsStrip wallet={account.address} />}

      <RedeemQRDialog open={qrOpen} onOpenChange={setQrOpen} />
      {checkInBounty && account && (
        <CheckInQRDialog
          open={!!checkInBounty}
          onOpenChange={(o) => !o && setCheckInBounty(null)}
          bountyId={checkInBounty.id}
          bountyName={checkInBounty.name}
          walletAddress={account.address}
        />
      )}
      <BountyDetailsDialog
        bounty={details}
        onOpenChange={(o) => !o && setDetails(null)}
      />
    </main>
  );
}

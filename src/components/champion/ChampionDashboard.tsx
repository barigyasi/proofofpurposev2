import { useMemo, useState } from "react";
import { useActiveAccount } from "thirdweb/react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PurposeBalanceCard } from "@/components/champion/PurposeBalanceCard";
import { RedeemQRDialog } from "@/components/champion/RedeemQRDialog";
import { SectionDivider } from "@/components/champion/SectionDivider";
import { BountyCard } from "@/components/bounties/BountyCard";
import { BountyDetailsDialog } from "@/components/bounties/BountyDetailsDialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useBounties, type Bounty } from "@/hooks/useBounties";

export function ChampionDashboard() {
  const account = useActiveAccount();
  const qc = useQueryClient();
  const { data: bounties, isLoading } = useBounties();
  const [qrOpen, setQrOpen] = useState(false);
  const [details, setDetails] = useState<Bounty | null>(null);
  const [signingUp, setSigningUp] = useState<number | null>(null);

  const wallet = account?.address.toLowerCase() ?? "";

  const { active, available } = useMemo(() => {
    const a: Bounty[] = [];
    const v: Bounty[] = [];
    for (const b of bounties ?? []) {
      const joined = b.participants.some((p) => p.toLowerCase() === wallet);
      if (b.completed) continue;
      if (joined) a.push(b);
      else v.push(b);
    }
    return { active: a, available: v };
  }, [bounties, wallet]);

  async function signUp(bounty: Bounty) {
    if (!account) return;
    setSigningUp(bounty.id);
    try {
      const { error } = await supabase.functions.invoke("bounty-signup", {
        body: { bountyId: bounty.id, walletAddress: account.address },
      });
      if (error) throw error;
      toast.success("Signed up!");
      await qc.invalidateQueries({ queryKey: ["bounties"] });
    } catch (e) {
      toast.error(
        e instanceof Error
          ? e.message
          : "Sign-up failed. The contract may require an admin to add you.",
      );
    } finally {
      setSigningUp(null);
    }
  }

  if (!account) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16 text-center text-muted-foreground">
        Connect your wallet to view your dashboard.
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-center text-3xl font-bold">What's poppin, Champ? 🚀</h1>

      <div className="mt-8">
        <PurposeBalanceCard
          address={account.address}
          onShowQR={() => setQrOpen(true)}
        />
      </div>

      <div className="mt-10 space-y-3">
        <SectionDivider label="Active Bounties" />
        {isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : active.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No active bounties yet.
          </p>
        ) : (
          <div className="space-y-3">
            {active.map((b) => (
              <BountyCard
                key={b.id}
                bounty={b}
                mode="active"
                onViewDetails={() => setDetails(b)}
              />
            ))}
          </div>
        )}
      </div>

      <div className="mt-10 space-y-3">
        <SectionDivider label="Available Bounties" />
        {isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : available.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nothing available right now. Check back soon.
          </p>
        ) : (
          <div className="space-y-3">
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

      <RedeemQRDialog open={qrOpen} onOpenChange={setQrOpen} />
      <BountyDetailsDialog
        bounty={details}
        onOpenChange={(o) => !o && setDetails(null)}
      />
    </main>
  );
}

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useActiveAccount } from "thirdweb/react";
import { useSessionRoles } from "@/hooks/useSessionRoles";
import { useBounties } from "@/hooks/useBounties";
import { useBountyAdmin } from "@/hooks/useBountyAdmin";
import { CreateBountyDialog } from "@/components/bounties/CreateBountyDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

type Signup = {
  id: string;
  bounty_id: string;
  on_chain_bounty_id: number | null;
  wallet_address: string;
  status: string;
  created_at: string;
};

export default function AdminBounties() {
  const navigate = useNavigate();
  const account = useActiveAccount();
  const { session, roles, isLoading } = useSessionRoles();
  const { data: bounties, isLoading: bountiesLoading } = useBounties();
  const { busy, completeBounty, addParticipant } = useBountyAdmin();
  const [open, setOpen] = useState(false);
  const [addAddr, setAddAddr] = useState<Record<number, string>>({});
  const [signups, setSignups] = useState<Signup[]>([]);

  async function loadSignups() {
    const { data } = await supabase
      .from("bounty_signups")
      .select("id,bounty_id,on_chain_bounty_id,wallet_address,status,created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: true });
    setSignups((data ?? []) as Signup[]);
  }

  useEffect(() => {
    if (roles.includes("admin")) loadSignups();
  }, [roles, busy]);

  useEffect(() => {
    if (isLoading) return;
    if (!session) navigate("/login", { replace: true });
    else if (!roles.includes("admin")) navigate("/dashboard", { replace: true });
  }, [isLoading, session, roles, navigate]);

  if (isLoading || !roles.includes("admin")) return null;

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-foreground pb-6">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            // admin
          </p>
          <h1 className="mt-2 font-display text-5xl">BOUNTIES</h1>
          {account && (
            <p className="mt-2 font-mono text-[10px] text-muted-foreground">
              admin: {account.address}
            </p>
          )}
        </div>
        <Button onClick={() => setOpen(true)} className="brutal-primary brutal-hover font-display">
          + NEW BOUNTY
        </Button>
      </div>

      <div className="mt-8 space-y-4">
        {bountiesLoading ? (
          <p className="font-mono text-xs text-muted-foreground">// loading…</p>
        ) : !bounties?.length ? (
          <p className="font-mono text-xs text-muted-foreground">// no bounties yet</p>
        ) : (
          bounties.map((b) => (
            <div key={b.id} className="brutal p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-[10px] uppercase text-muted-foreground">
                    {b.onChainId !== null ? `#${b.onChainId}` : "off-chain"} · {b.status.toUpperCase()}
                  </p>
                  <h3 className="mt-1 font-display text-2xl">{b.name}</h3>
                  <p className="mt-1 max-w-xl text-sm text-muted-foreground">{b.description}</p>
                </div>
                <div className="text-right">
                  <p className="font-display text-xl text-primary">
                    {b.rewardAmount.toLocaleString()} PURPOSE
                  </p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t-2 border-foreground pt-3">
                {b.onChainId !== null && (
                  <>
                    <Input
                      placeholder="0x… add participant"
                      value={addAddr[b.onChainId] ?? ""}
                      onChange={(e) =>
                        setAddAddr({ ...addAddr, [b.onChainId as number]: e.target.value })
                      }
                      className="max-w-xs"
                    />
                    <Button
                      variant="outline"
                      disabled={busy || !addAddr[b.onChainId]}
                      onClick={() => addParticipant(b.onChainId as number, addAddr[b.onChainId as number])}
                    >
                      ADD
                    </Button>
                  </>
                )}
                {b.status === "open" && (
                  <Button
                    disabled={busy}
                    onClick={() => completeBounty(b.id, b.onChainId)}
                    className="brutal-primary brutal-hover font-display"
                  >
                    COMPLETE
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <CreateBountyDialog open={open} onOpenChange={setOpen} />
    </main>
  );
}

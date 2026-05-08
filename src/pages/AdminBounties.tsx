import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useActiveAccount } from "thirdweb/react";
import { useSessionRoles } from "@/hooks/useSessionRoles";
import { useBounties } from "@/hooks/useBounties";
import { useBountyAdmin } from "@/hooks/useBountyAdmin";
import { CreateBountyDialog } from "@/components/bounties/CreateBountyDialog";
import { TreasuryHeadroomCard } from "@/components/admin/TreasuryHeadroomCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useParticipantNames } from "@/hooks/useParticipantNames";
import { ParticipantLabel } from "@/components/ParticipantLabel";

type Signup = {
  id: string;
  bounty_id: string;
  on_chain_bounty_id: number | null;
  wallet_address: string;
  user_id: string | null;
  status: string;
  created_at: string;
};

export default function AdminBounties() {
  const navigate = useNavigate();
  const account = useActiveAccount();
  const { session, roles, isLoading } = useSessionRoles();
  const { data: bounties, isLoading: bountiesLoading } = useBounties();
  const { busy, completeBounty, addParticipant, startEvent } = useBountyAdmin();
  const [open, setOpen] = useState(false);
  const [addAddr, setAddAddr] = useState<Record<number, string>>({});
  const [signups, setSignups] = useState<Signup[]>([]);

  async function loadSignups() {
    const { data } = await supabase
      .from("bounty_signups")
      .select("id,bounty_id,on_chain_bounty_id,wallet_address,user_id,status,created_at")
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

  const names = useParticipantNames(signups);

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

      <div className="mt-6">
        <TreasuryHeadroomCard />
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
              {(() => {
                const all = signups.filter((s) => s.bounty_id === b.id);
                const pending = all.filter((s) => s.status === "pending");
                const checkedIn = all.filter((s) => s.status === "checked_in" || s.status === "added");
                return (
                  <>
                    <div className="mt-3 flex flex-wrap gap-3 font-mono text-[10px] uppercase text-muted-foreground">
                      <span>signed up: <span className="text-foreground">{all.length}</span></span>
                      <span>checked in: <span className="text-primary">{checkedIn.length}</span></span>
                      <span>min required: {b.minParticipants}</span>
                    </div>
                    {all.length > 0 && (
                      <div className="mt-3 border-t-2 border-foreground pt-3">
                        <p className="font-mono text-[10px] uppercase tracking-widest text-primary">
                          // signups
                        </p>
                        <div className="mt-2 space-y-2">
                          {all.map((s) => (
                            <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 bg-muted/30 p-2">
                              <div className="flex flex-col gap-0.5">
                                <ParticipantLabel
                                  wallet={s.wallet_address}
                                  name={names.get(s.wallet_address.toLowerCase())}
                                />
                                <span className="font-mono text-[9px] uppercase text-muted-foreground">{s.status}</span>
                              </div>
                              {s.status === "pending" && b.status === "running" && b.onChainId !== null && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={busy}
                                  onClick={() => addParticipant(b.onChainId as number, s.wallet_address, b.id)}
                                >
                                  CHECK IN MANUALLY
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t-2 border-foreground pt-3">
                {b.status === "open" && (
                  <Button
                    disabled={busy || signups.filter((s) => s.bounty_id === b.id).length < b.minParticipants}
                    onClick={() => startEvent(b.id)}
                    className="brutal-primary brutal-hover font-display"
                  >
                    START EVENT
                  </Button>
                )}
                {b.status === "running" && (
                  <>
                    <Button
                      onClick={() => navigate(`/admin/bounties/${b.id}/scan`)}
                      className="brutal-primary brutal-hover font-display"
                    >
                      OPEN SCANNER
                    </Button>
                    {b.onChainId !== null && (
                      <>
                        <Input
                          placeholder="0x… add manually"
                          value={addAddr[b.onChainId] ?? ""}
                          onChange={(e) =>
                            setAddAddr({ ...addAddr, [b.onChainId as number]: e.target.value })
                          }
                          className="max-w-xs"
                        />
                        <Button
                          variant="outline"
                          disabled={busy || !addAddr[b.onChainId]}
                          onClick={() => addParticipant(b.onChainId as number, addAddr[b.onChainId as number], b.id)}
                        >
                          ADD
                        </Button>
                      </>
                    )}
                    <Button
                      disabled={busy}
                      onClick={() => completeBounty(b.id, b.onChainId)}
                      className="brutal-primary brutal-hover font-display"
                    >
                      END EVENT
                    </Button>
                  </>
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

import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { useActiveAccount } from "thirdweb/react";
import { supabase } from "@/integrations/supabase/client";

const TILES = [
  { label: "APPLICANTS", desc: "Review pending champions + vendors", soon: true },
  { label: "BOUNTIES", desc: "Create, fund, complete bounties", soon: true },
  { label: "VENDORS", desc: "Approve / revoke vendor wallets", soon: true },
  { label: "DONATIONS", desc: "Live ledger of inflows", soon: true },
  { label: "AUDIT LOG", desc: "Every admin action, on-chain + off", soon: true },
  { label: "TREASURY", desc: "USDC + PURPOSE positions", soon: true },
];

export default function Admin() {
  const account = useActiveAccount();
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) {
      setIsAdmin(false);
      return;
    }
    supabase
      .rpc("has_role", { _user_id: session.user.id, _role: "admin" })
      .then(({ data }) => setIsAdmin(!!data));
  }, [session]);

  if (session === undefined) return null;
  if (!session) return <Navigate to="/login" replace />;
  if (isAdmin === null) return null;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="border-b-2 border-foreground pb-6">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          // super admin
        </p>
        <h1 className="mt-3 font-display text-5xl sm:text-7xl">
          MISSION<br />
          <span className="text-primary">CONTROL</span>
        </h1>
        {account && (
          <p className="mt-3 font-mono text-xs text-muted-foreground">
            {account.address}
          </p>
        )}
      </div>

      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {TILES.map((t) => (
          <div key={t.label} className="brutal brutal-hover p-6">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-2xl">{t.label}</h3>
              {t.soon && (
                <span className="brutal-primary px-2 py-0.5 font-mono text-[10px] uppercase">
                  soon
                </span>
              )}
            </div>
            <p className="mt-3 text-sm text-muted-foreground">{t.desc}</p>
          </div>
        ))}
      </div>
    </main>
  );
}

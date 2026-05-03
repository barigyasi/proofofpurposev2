import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useActiveAccount } from "thirdweb/react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { ConnectWalletButton } from "@/components/auth/ConnectWalletButton";

export default function Login() {
  const account = useActiveAccount();
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    return () => sub.subscription.unsubscribe();
  }, []);

  // Once the supabase session lands, route to /dashboard (which fans out by role)
  useEffect(() => {
    if (!session || redirecting) return;
    setRedirecting(true);
    navigate("/dashboard", { replace: true });
  }, [session, redirecting, navigate]);

  return (
    <main className="mx-auto max-w-2xl px-4 py-12 sm:px-6 sm:py-20">
      <div className="border-b-2 border-foreground pb-6">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          // sign in
        </p>
        <h1 className="mt-3 font-display text-5xl sm:text-7xl">
          PLUG<br />
          <span className="text-primary">IN.</span>
        </h1>
        <p className="mt-4 max-w-md text-sm text-muted-foreground">
          Connect a wallet to access champion, vendor, donor, or admin dashboards.
          Email + Google + Apple + passkey all work — we wrap them in a smart
          account on Base. Gas is on us.
        </p>
      </div>

      <div className="mt-8">
        <ConnectWalletButton />
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <div className="brutal p-4">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            wallet
          </p>
          <p className="mt-2 break-all font-mono text-xs">
            {account?.address ?? "—"}
          </p>
        </div>
        <div className="brutal p-4">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            session
          </p>
          <p className="mt-2 font-mono text-xs">
            {session ? "✓ active" : "— none"}
          </p>
        </div>
      </div>
    </main>
  );
}

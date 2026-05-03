import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { ConnectWalletButton } from "@/components/auth/ConnectWalletButton";

export default function Login() {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  const [adminMode, setAdminMode] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    return () => sub.subscription.unsubscribe();
  }, []);

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
          {adminMode
            ? "Connect your admin wallet (MetaMask / Coinbase / WalletConnect) to access mission control."
            : "Sign in with email, Google, Apple, or passkey. No setup, no fees."}
        </p>
      </div>

      <div className="mt-8">
        <ConnectWalletButton mode={adminMode ? "admin" : "default"} />
      </div>

      <div className="mt-10 text-center">
        <button
          onClick={() => setAdminMode((v) => !v)}
          className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
        >
          {adminMode ? "← back to standard sign-in" : "admin sign-in →"}
        </button>
      </div>
    </main>
  );
}

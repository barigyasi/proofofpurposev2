import { useEffect, useState } from "react";
import { useActiveAccount } from "thirdweb/react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { ConnectWalletButton } from "@/components/auth/ConnectWalletButton";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Login() {
  const account = useActiveAccount();
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<string[]>([]);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) {
      setRoles([]);
      return;
    }
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id)
      .then(({ data }) => setRoles((data ?? []).map((r) => r.role)));
  }, [session]);

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 px-6 py-16">
      <header>
        <p className="text-sm uppercase tracking-widest text-primary">Proof of Purpose</p>
        <h1 className="mt-2 text-4xl font-bold">Sign in</h1>
        <p className="mt-2 text-muted-foreground">
          Connect your wallet to access champion, vendor, donor, or admin dashboards.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Wallet</CardTitle>
        </CardHeader>
        <CardContent>
          <ConnectWalletButton />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Row label="Wallet" value={account?.address ?? "—"} />
          <Row label="Supabase user" value={session?.user.id ?? "—"} />
          <Row label="Roles" value={roles.length ? roles.join(", ") : "—"} />
        </CardContent>
      </Card>

      <RoleGuard role="admin" fallback={
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            Admin-only content hidden. Sign in with an allowlisted wallet to see it.
          </CardContent>
        </Card>
      }>
        <Card className="border-primary">
          <CardHeader>
            <CardTitle>Admin access confirmed</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            You're signed in with an admin wallet. Phase 1 verified.
          </CardContent>
        </Card>
      </RoleGuard>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-muted-foreground">{label}</span>
      <code className="break-all rounded bg-secondary px-2 py-1 text-xs text-secondary-foreground">
        {value}
      </code>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import {
  useActiveAccount,
  useDisconnect,
  useActiveWallet,
  ConnectButton,
} from "thirdweb/react";
import { thirdwebClient, baseChain, wallets, adminWallets } from "@/lib/thirdweb";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  /** "default" = in-app smart wallet (champions/catalysts/donors/vendors). "admin" = EOA only. */
  mode?: "default" | "admin";
  label?: string;
}

/**
 * Sign in flow: connect → backend nonce → sign → backend verifies → supabase session.
 */
export function ConnectWalletButton({ mode = "default", label }: Props) {
  const account = useActiveAccount();
  const wallet = useActiveWallet();
  const { disconnect } = useDisconnect();
  const [authing, setAuthing] = useState(false);
  const [authedWallet, setAuthedWallet] = useState<string | null>(null);
  const inFlight = useRef<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const email = data.session?.user.email;
      if (email?.endsWith("@wallet.local")) {
        setAuthedWallet(email.split("@")[0]);
      }
    });
  }, []);

  useEffect(() => {
    if (!account) return;
    const addr = account.address.toLowerCase();
    if (authedWallet === addr) return;
    if (inFlight.current === addr) return;
    inFlight.current = addr;
    authenticate().finally(() => {
      inFlight.current = null;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.address, authedWallet]);

  async function authenticate() {
    if (!account) return;
    setAuthing(true);
    try {
      const walletAddress = account.address;
      const nonceRes = await supabase.functions.invoke("wallet-auth-nonce", {
        body: { walletAddress },
      });
      if (nonceRes.error) throw nonceRes.error;
      const { message } = nonceRes.data as { nonce: string; message: string };

      const signature = await account.signMessage({ message });

      const authRes = await supabase.functions.invoke("wallet-auth", {
        body: { walletAddress, signature, message },
      });
      if (authRes.error) throw authRes.error;
      const { userId, session } = authRes.data as {
        userId: string;
        session: { access_token: string; refresh_token: string };
      };

      const { error } = await supabase.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      });
      if (error) throw error;

      // Friendly rejection: admin entry requires an admin role
      if (mode === "admin") {
        const { data: roleRow } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId)
          .eq("role", "admin")
          .maybeSingle();
        if (!roleRow) {
          await fullDisconnect();
          toast.error("This wallet isn't on the admin allowlist. Use standard ENTER instead.");
          return;
        }
      }

      setAuthedWallet(walletAddress.toLowerCase());
      toast.success("Signed in");
    } catch (e: unknown) {
      console.error("auth failed", e);
      toast.error(e instanceof Error ? e.message : "Entry failed. Please try again.");
    } finally {
      setAuthing(false);
    }
  }

  async function fullDisconnect() {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn("signOut", e);
    }
    if (wallet) {
      try {
        await disconnect(wallet);
      } catch (e) {
        console.warn("disconnect", e);
      }
    }
    setAuthedWallet(null);
  }

  if (!account) {
    const isAdmin = mode === "admin";
    return (
      <ConnectButton
        client={thirdwebClient}
        chain={baseChain}
        wallets={isAdmin ? adminWallets : wallets}
        connectButton={{
          label: label ?? (isAdmin ? "ADMIN ENTER →" : "ENTER →"),
          className:
            "!font-display !text-lg !px-8 !py-5 !rounded-none !border-2 !border-foreground !bg-primary !text-primary-foreground",
        }}
        connectModal={{
          size: "compact",
          title: isAdmin ? "Admin entry" : "Enter Proof of Purpose",
          showThirdwebBranding: false,
        }}
      />
    );
  }

  const isAuthed = authedWallet && authedWallet === account.address.toLowerCase();
  const isAdmin = mode === "admin";

  return (
    <div className="space-y-3">
      <div className="brutal flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {isAdmin ? "address" : "account"}
          </p>
          <code className="font-mono text-sm">
            {isAdmin
              ? `${account.address.slice(0, 8)}…${account.address.slice(-6)}`
              : "✓ ready"}
          </code>
        </div>
        <div>
          {authing ? (
            <span className="font-display text-sm text-primary">VERIFYING…</span>
          ) : isAuthed ? (
            <span className="font-display text-sm text-primary">✓ READY</span>
          ) : (
            <button
              onClick={authenticate}
              className="brutal-primary brutal-hover px-4 py-2 font-display text-sm"
            >
              RETRY ENTRY
            </button>
          )}
        </div>
      </div>
      <button
        onClick={fullDisconnect}
        className="brutal brutal-hover w-full px-4 py-2 font-display text-sm"
      >
        SIGN OUT
      </button>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import {
  useActiveAccount,
  useConnect,
  useDisconnect,
  useActiveWallet,
  ConnectButton,
} from "thirdweb/react";
import { thirdwebClient, baseChain, wallets } from "@/lib/thirdweb";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * SIWE-style flow that auto-triggers as soon as a wallet is connected:
 *   1. Wallet connects via thirdweb (in-app or external).
 *   2. Backend issues nonce/message.
 *   3. Wallet signs the message.
 *   4. Backend verifies sig + creates Supabase session.
 *   5. supabase-js client is hydrated with the session.
 */
export function ConnectWalletButton() {
  const account = useActiveAccount();
  const wallet = useActiveWallet();
  const { disconnect } = useDisconnect();
  const [authing, setAuthing] = useState(false);
  const [authedWallet, setAuthedWallet] = useState<string | null>(null);
  const inFlight = useRef<string | null>(null);

  // Pick up an existing supabase session on mount
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const email = data.session?.user.email;
      if (email?.endsWith("@wallet.local")) {
        setAuthedWallet(email.split("@")[0]);
      }
    });
  }, []);

  // Auto-authenticate once a wallet is connected
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
      const { session } = authRes.data as {
        userId: string;
        session: { access_token: string; refresh_token: string };
      };

      const { error } = await supabase.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      });
      if (error) throw error;

      setAuthedWallet(walletAddress.toLowerCase());
      toast.success("Signed in");
    } catch (e: unknown) {
      console.error("wallet auth failed", e);
      toast.error(
        e instanceof Error ? e.message : "Sign-in failed. Please try again.",
      );
    } finally {
      setAuthing(false);
    }
  }

  async function fullDisconnect() {
    try {
      await supabase.auth.signOut().catch(() => {});
      if (wallet) await disconnect(wallet).catch(() => {});
      setAuthedWallet(null);
    } catch (e) {
      console.error(e);
    }
  }

  if (!account) {
    return (
      <ConnectButton
        client={thirdwebClient}
        chain={baseChain}
        wallets={wallets}
        connectButton={{
          label: "CONNECT WALLET →",
          className: "!font-display !text-lg !px-8 !py-5 !rounded-none !border-2 !border-foreground !bg-primary !text-primary-foreground",
        }}
        connectModal={{ size: "compact", title: "Sign in to Proof of Purpose" }}
      />
    );
  }

  const isAuthed =
    authedWallet && authedWallet === account.address.toLowerCase();

  return (
    <div className="space-y-3">
      <div className="brutal flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            wallet
          </p>
          <code className="font-mono text-sm">
            {account.address.slice(0, 8)}…{account.address.slice(-6)}
          </code>
        </div>
        <div>
          {authing ? (
            <span className="font-display text-sm text-primary">SIGNING…</span>
          ) : isAuthed ? (
            <span className="font-display text-sm text-primary">✓ SIGNED IN</span>
          ) : (
            <button
              onClick={authenticate}
              className="brutal-primary brutal-hover px-4 py-2 font-display text-sm"
            >
              RETRY SIGN-IN
            </button>
          )}
        </div>
      </div>
      <button
        onClick={fullDisconnect}
        className="brutal brutal-hover w-full px-4 py-2 font-display text-sm"
      >
        DISCONNECT
      </button>
    </div>
  );
}

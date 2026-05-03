import { useState } from "react";
import {
  useActiveAccount,
  useConnect,
  useDisconnect,
  useActiveWallet,
  ConnectButton,
} from "thirdweb/react";
import { thirdwebClient, baseChain, wallets } from "@/lib/thirdweb";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

/**
 * Drives the SIWE-style flow:
 *   1. User connects a wallet via thirdweb (in-app or external).
 *   2. We ask backend for a nonce/message.
 *   3. Wallet signs the message.
 *   4. Backend verifies sig + creates/returns a Supabase session.
 *   5. We hydrate the supabase-js client with the session.
 */
export function ConnectWalletButton() {
  const account = useActiveAccount();
  const wallet = useActiveWallet();
  const { disconnect } = useDisconnect();
  const [authing, setAuthing] = useState(false);
  const [authedWallet, setAuthedWallet] = useState<string | null>(null);

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
      console.error(e);
      toast.error(
        e instanceof Error ? e.message : "Sign-in failed. Please try again.",
      );
    } finally {
      setAuthing(false);
    }
  }

  async function fullDisconnect() {
    try {
      await supabase.auth.signOut();
      if (wallet) await disconnect(wallet);
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
        connectButton={{ label: "Connect Wallet" }}
        connectModal={{ size: "compact", title: "Sign in to Proof of Purpose" }}
      />
    );
  }

  const isAuthed =
    authedWallet && authedWallet === account.address.toLowerCase();

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <code className="rounded-md bg-secondary px-2 py-1 text-xs text-secondary-foreground">
        {account.address.slice(0, 6)}…{account.address.slice(-4)}
      </code>
      {!isAuthed ? (
        <Button onClick={authenticate} disabled={authing}>
          {authing ? "Signing in…" : "Sign in"}
        </Button>
      ) : (
        <span className="text-sm text-muted-foreground">Signed in</span>
      )}
      <Button variant="secondary" onClick={fullDisconnect}>
        Disconnect
      </Button>
    </div>
  );
}

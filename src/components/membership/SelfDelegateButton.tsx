import { useEffect, useState } from "react";
import { getContract, prepareContractCall, sendTransaction, waitForReceipt, readContract } from "thirdweb";
import { useActiveAccount } from "thirdweb/react";
import { toast } from "sonner";
import { thirdwebClient, baseChain } from "@/lib/thirdweb";
import { CONTRACTS_V2 } from "@/config/contracts";
import { Button } from "@/components/ui/button";

/**
 * Activates a holder's vPURPOSE voting power by calling `delegate(self)` on the
 * vPURPOSE ERC20Votes token. Until this is done, the Governor counts the
 * holder's votes as 0 even if they hold vPURPOSE.
 */
export function SelfDelegateButton({ className }: { className?: string }) {
  const account = useActiveAccount();
  const [busy, setBusy] = useState(false);
  const [delegated, setDelegated] = useState<boolean | null>(null);

  useEffect(() => {
    if (!account) return;
    let cancelled = false;
    (async () => {
      try {
        const contract = getContract({
          client: thirdwebClient,
          chain: baseChain,
          address: CONTRACTS_V2.VPURPOSE_TOKEN,
        });
        const current = (await readContract({
          contract,
          method: "function delegates(address) view returns (address)",
          params: [account.address],
        })) as string;
        if (!cancelled) {
          setDelegated(current.toLowerCase() === account.address.toLowerCase());
        }
      } catch {
        if (!cancelled) setDelegated(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [account?.address]);

  async function handleDelegate() {
    if (!account) {
      toast.error("Connect your wallet first");
      return;
    }
    setBusy(true);
    try {
      const contract = getContract({
        client: thirdwebClient,
        chain: baseChain,
        address: CONTRACTS_V2.VPURPOSE_TOKEN,
      });
      const tx = prepareContractCall({
        contract,
        method: "function delegate(address delegatee)",
        params: [account.address],
      });
      const { transactionHash } = await sendTransaction({ transaction: tx, account });
      await waitForReceipt({ client: thirdwebClient, chain: baseChain, transactionHash });
      setDelegated(true);
      toast.success("Voting power activated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delegation failed");
    } finally {
      setBusy(false);
    }
  }

  if (!account || delegated === true) return null;

  return (
    <Button
      onClick={handleDelegate}
      disabled={busy}
      variant="default"
      className={className}
    >
      {busy ? "Activating…" : "Activate voting power"}
    </Button>
  );
}

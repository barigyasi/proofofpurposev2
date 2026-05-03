import { useEffect, useRef } from "react";
import { useActiveAccount } from "thirdweb/react";
import {
  getContract,
  prepareContractCall,
  sendTransaction,
  readContract,
} from "thirdweb";
import { thirdwebClient, baseChain } from "@/lib/thirdweb";
import { CONTRACTS_V2, V2_LIVE } from "@/config/contracts";

const MAX_UINT256 = (1n << 256n) - 1n;

/**
 * Silently ensures the active champion smart wallet has a max ERC20 allowance
 * on PurposeTokenV2 for VendorRedemptionV2 (sponsored gas, no confirmation UI).
 *
 * Safe to call repeatedly — bails out if allowance is already non-zero or if
 * V2 contracts are not yet configured.
 */
export function useSilentRedemptionApprove() {
  const account = useActiveAccount();
  const ranFor = useRef<string | null>(null);

  useEffect(() => {
    if (!V2_LIVE || !account) return;
    if (ranFor.current === account.address.toLowerCase()) return;
    ranFor.current = account.address.toLowerCase();

    (async () => {
      try {
        const purpose = getContract({
          client: thirdwebClient,
          chain: baseChain,
          address: CONTRACTS_V2.PURPOSE_TOKEN as `0x${string}`,
        });
        const current = (await readContract({
          contract: purpose,
          method: "function allowance(address,address) view returns (uint256)",
          params: [
            account.address as `0x${string}`,
            CONTRACTS_V2.VENDOR_REDEMPTION as `0x${string}`,
          ],
        })) as bigint;
        if (current >= 1_000_000_000_000n * 10n ** 18n) return; // already plenty
        const tx = prepareContractCall({
          contract: purpose,
          method: "function approve(address,uint256) returns (bool)",
          params: [CONTRACTS_V2.VENDOR_REDEMPTION as `0x${string}`, MAX_UINT256],
        });
        await sendTransaction({ transaction: tx, account });
      } catch (e) {
        console.warn("silent approve failed (non-fatal)", e);
      }
    })();
  }, [account]);
}

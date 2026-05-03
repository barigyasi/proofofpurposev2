import { useState } from "react";
import { getContract, prepareContractCall, sendTransaction, waitForReceipt, readContract } from "thirdweb";
import { useActiveAccount } from "thirdweb/react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { thirdwebClient, baseChain } from "@/lib/thirdweb";
import { CONTRACTS, PURPOSE_DECIMALS } from "@/config/contracts";
import { supabase } from "@/integrations/supabase/client";

function bm() {
  return getContract({ client: thirdwebClient, chain: baseChain, address: CONTRACTS.BOUNTY_MANAGER });
}

export function toPurposeWei(amount: string): bigint {
  const [w, f = ""] = amount.split(".");
  const frac = (f + "0".repeat(PURPOSE_DECIMALS)).slice(0, PURPOSE_DECIMALS);
  return BigInt(w || "0") * 10n ** BigInt(PURPOSE_DECIMALS) + BigInt(frac || "0");
}

export function useBountyAdmin() {
  const account = useActiveAccount();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  async function preflight(): Promise<{ ok: boolean; reason?: string }> {
    if (!account) return { ok: false, reason: "Connect wallet" };
    const contract = bm();
    const [owner, approved] = await Promise.all([
      readContract({ contract, method: "function owner() view returns (address)", params: [] }) as Promise<string>,
      readContract({
        contract,
        method: "function approvedAdmins(address) view returns (bool)",
        params: [account.address as `0x${string}`],
      }) as Promise<boolean>,
    ]);
    if (owner.toLowerCase() === account.address.toLowerCase() || approved) return { ok: true };
    return { ok: false, reason: "Connected wallet is not the contract owner or an approved admin" };
  }

  async function createBounty(input: {
    name: string;
    description: string;
    rewardAmount: string;
    maxParticipants: number;
    imageUrl?: string | null;
    location?: string | null;
    expiresAt?: string | null;
  }) {
    if (!account) throw new Error("Connect wallet");
    setBusy(true);
    try {
      const contract = bm();
      const tx = prepareContractCall({
        contract,
        method:
          "function createBounty(string name, string description, uint256 rewardAmount, uint256 maxParticipants)",
        params: [
          input.name,
          input.description,
          toPurposeWei(input.rewardAmount),
          BigInt(input.maxParticipants),
        ],
      });
      const { transactionHash } = await sendTransaction({ transaction: tx, account });
      await waitForReceipt({ client: thirdwebClient, chain: baseChain, transactionHash });

      // derive new id
      const count = (await readContract({
        contract,
        method: "function bountyCount() view returns (uint256)",
        params: [],
      })) as bigint;
      const newId = Number(count) - 1;

      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("bounties").insert({
        title: input.name,
        description: input.description,
        reward_amount: Number(input.rewardAmount),
        on_chain_id: newId,
        on_chain_tx_hash: transactionHash,
        image_url: input.imageUrl ?? null,
        location: input.location ?? null,
        expires_at: input.expiresAt ?? null,
        created_by: user?.id ?? null,
        status: "open",
      });

      toast.success(`Bounty #${newId} created`);
      await qc.invalidateQueries({ queryKey: ["bounties"] });
      return { id: newId, hash: transactionHash };
    } finally {
      setBusy(false);
    }
  }

  async function completeBounty(id: number) {
    if (!account) throw new Error("Connect wallet");
    setBusy(true);
    try {
      const tx = prepareContractCall({
        contract: bm(),
        method: "function completeBounty(uint256 bountyId)",
        params: [BigInt(id)],
      });
      const { transactionHash } = await sendTransaction({ transaction: tx, account });
      await waitForReceipt({ client: thirdwebClient, chain: baseChain, transactionHash });
      toast.success(`Bounty #${id} completed`);
      await qc.invalidateQueries({ queryKey: ["bounties"] });
    } finally {
      setBusy(false);
    }
  }

  async function addParticipant(id: number, addr: string) {
    if (!account) throw new Error("Connect wallet");
    setBusy(true);
    try {
      const tx = prepareContractCall({
        contract: bm(),
        method: "function addParticipant(uint256 bountyId, address participant)",
        params: [BigInt(id), addr as `0x${string}`],
      });
      const { transactionHash } = await sendTransaction({ transaction: tx, account });
      await waitForReceipt({ client: thirdwebClient, chain: baseChain, transactionHash });
      toast.success("Participant added");
      await qc.invalidateQueries({ queryKey: ["bounties"] });
    } finally {
      setBusy(false);
    }
  }

  return { busy, preflight, createBounty, completeBounty, addParticipant };
}

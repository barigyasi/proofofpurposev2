import { useState } from "react";
import { getContract, prepareContractCall, sendTransaction, waitForReceipt, readContract } from "thirdweb";
import { useActiveAccount } from "thirdweb/react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { decodeEventLog, parseAbiItem } from "viem";
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

const BOUNTY_CREATED_EVENT = parseAbiItem(
  "event BountyCreated(uint256 bountyId, uint256 rewardAmount)"
);

export function useBountyAdmin() {
  const account = useActiveAccount();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  async function preflight(): Promise<{ ok: boolean; reason?: string }> {
    if (!account) return { ok: false, reason: "Connect wallet" };
    try {
      const contract = bm();
      const owner = (await readContract({
        contract,
        method: "function owner() view returns (address)",
        params: [],
      })) as string;
      if (owner.toLowerCase() === account.address.toLowerCase()) return { ok: true };
      try {
        const approved = (await readContract({
          contract,
          method: "function approvedAdmins(address) view returns (bool)",
          params: [account.address as `0x${string}`],
        })) as boolean;
        if (approved) return { ok: true };
      } catch {
        // method may not exist on contract — ignore
      }
      return { ok: false, reason: "Connected wallet is not the contract owner" };
    } catch (e) {
      return { ok: false, reason: e instanceof Error ? e.message : "Preflight failed" };
    }
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
    const reward = Number(input.rewardAmount);
    if (!isFinite(reward) || reward <= 0) throw new Error("Reward must be > 0");
    if (!input.maxParticipants || input.maxParticipants < 1) throw new Error("Max participants must be ≥ 1");
    setBusy(true);
    try {
      const contract = bm();
      const tx = prepareContractCall({
        contract,
        method: "function createBounty(uint256 rewardAmount) returns (uint256)",
        params: [toPurposeWei(input.rewardAmount)],
      });
      const { transactionHash } = await sendTransaction({ transaction: tx, account });
      const receipt = await waitForReceipt({ client: thirdwebClient, chain: baseChain, transactionHash });

      // Decode bountyId from BountyCreated logs
      let onChainId: number | null = null;
      for (const log of receipt.logs as unknown as Array<{ data: `0x${string}`; topics: [`0x${string}`, ...`0x${string}`[]] }>) {
        try {
          const decoded = decodeEventLog({
            abi: [BOUNTY_CREATED_EVENT],
            data: log.data,
            topics: log.topics,
          }) as { eventName: string; args: { bountyId: bigint; rewardAmount: bigint } };
          if (decoded.eventName === "BountyCreated") {
            onChainId = Number(decoded.args.bountyId);
            break;
          }
        } catch {
          // skip unrelated logs
        }
      }

      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("bounties").insert({
        title: input.name,
        description: input.description,
        reward_amount: reward,
        on_chain_id: onChainId,
        on_chain_tx_hash: transactionHash,
        image_url: input.imageUrl ?? null,
        location: input.location ?? null,
        expires_at: input.expiresAt ?? null,
        created_by: user?.id ?? null,
        status: "open",
      });
      if (error) throw error;

      toast.success(onChainId !== null ? `Bounty #${onChainId} created` : "Bounty created");
      await qc.invalidateQueries({ queryKey: ["bounties"] });
      return { id: onChainId, hash: transactionHash };
    } finally {
      setBusy(false);
    }
  }

  async function completeBounty(rowId: string, onChainId: number | null) {
    if (!account) throw new Error("Connect wallet");
    setBusy(true);
    try {
      if (onChainId !== null) {
        const tx = prepareContractCall({
          contract: bm(),
          method: "function completeBounty(uint256 bountyId)",
          params: [BigInt(onChainId)],
        });
        const { transactionHash } = await sendTransaction({ transaction: tx, account });
        await waitForReceipt({ client: thirdwebClient, chain: baseChain, transactionHash });
      }
      const { error } = await supabase.from("bounties").update({ status: "completed" }).eq("id", rowId);
      if (error) throw error;
      toast.success("Bounty completed");
      await qc.invalidateQueries({ queryKey: ["bounties"] });
    } finally {
      setBusy(false);
    }
  }

  async function addParticipant(onChainId: number, addr: string) {
    if (!account) throw new Error("Connect wallet");
    if (onChainId === null || onChainId === undefined) throw new Error("No on-chain id");
    setBusy(true);
    try {
      const tx = prepareContractCall({
        contract: bm(),
        method: "function addParticipant(uint256 bountyId, address participant)",
        params: [BigInt(onChainId), addr as `0x${string}`],
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

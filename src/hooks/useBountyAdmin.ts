import { useState } from "react";
import { getContract, prepareContractCall, sendTransaction, waitForReceipt, readContract } from "thirdweb";
import { useActiveAccount } from "thirdweb/react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { decodeEventLog, parseAbiItem } from "viem";
import { thirdwebClient, baseChain } from "@/lib/thirdweb";
import { ACTIVE, PURPOSE_DECIMALS } from "@/config/contracts";
import { readTreasuryHeadroom } from "@/hooks/useTreasuryHeadroom";
import { supabase } from "@/integrations/supabase/client";

function bm() {
  return getContract({ client: thirdwebClient, chain: baseChain, address: ACTIVE.BOUNTY_MANAGER });
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
        max_participants: input.maxParticipants,
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

  async function startEvent(rowId: string) {
    setBusy(true);
    try {
      const token = crypto.randomUUID().replace(/-/g, "");
      const expires = new Date(Date.now() + 1000 * 60 * 60 * 12).toISOString();
      const { error } = await supabase
        .from("bounties")
        .update({
          status: "running",
          started_at: new Date().toISOString(),
          check_in_token: token,
          check_in_token_expires_at: expires,
        })
        .eq("id", rowId);
      if (error) throw error;
      toast.success("Event started — check-in QR is live");
      await qc.invalidateQueries({ queryKey: ["bounties"] });
    } finally {
      setBusy(false);
    }
  }

  async function completeBounty(rowId: string, onChainId: number | null) {
    if (!account) {
      toast.error("Connect admin wallet first");
      return;
    }
    setBusy(true);
    try {
      // Pre-end treasury check: how much PURPOSE will this event mint?
      const [{ data: bountyRow }, { count: checkedInCount }] = await Promise.all([
        supabase.from("bounties").select("reward_amount").eq("id", rowId).maybeSingle(),
        supabase
          .from("bounty_signups")
          .select("id", { count: "exact", head: true })
          .eq("bounty_id", rowId)
          .in("status", ["checked_in", "added"]),
      ]);
      const reward = Number(bountyRow?.reward_amount) || 0;
      const payouts = (checkedInCount ?? 0) * reward;

      if (payouts > 0) {
        const purpose = getContract({
          client: thirdwebClient,
          chain: baseChain,
          address: CONTRACTS.PURPOSE_TOKEN,
        });
        const balanceWei = (await readContract({
          contract: purpose,
          method: "function balanceOf(address) view returns (uint256)",
          params: [CONTRACTS.TREASURY as `0x${string}`],
        })) as bigint;
        const balance = Number(balanceWei) / 10 ** PURPOSE_DECIMALS;
        if (balance < payouts) {
          const proceed = window.confirm(
            `Treasury holds ${balance.toLocaleString()} PURPOSE but this event will mint ${payouts.toLocaleString()} PURPOSE to ${checkedInCount} checked-in participant(s). The on-chain end-event tx will revert. Send anyway?`,
          );
          if (!proceed) {
            setBusy(false);
            return;
          }
        }
      }

      if (onChainId !== null) {
        const tx = prepareContractCall({
          contract: bm(),
          method: "function completeBounty(uint256 bountyId)",
          params: [BigInt(onChainId)],
        });
        const { transactionHash } = await sendTransaction({ transaction: tx, account });
        await waitForReceipt({ client: thirdwebClient, chain: baseChain, transactionHash });
      }
      const { error } = await supabase
        .from("bounties")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", rowId);
      if (error) throw error;
      await supabase
        .from("bounty_signups")
        .update({ status: "no_show" })
        .eq("bounty_id", rowId)
        .eq("status", "pending");
      toast.success("Event ended — rewards minted to checked-in participants");
      await qc.invalidateQueries({ queryKey: ["bounties"] });
      await qc.invalidateQueries({ queryKey: ["bounty-signups"] });
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      if (/Treasury insufficient/i.test(raw)) {
        toast.error("Treasury is out of $PURPOSE — fund the Treasury contract before ending this event.", { duration: 8000 });
      } else if (/user rejected|denied/i.test(raw)) {
        toast.error("Transaction rejected in wallet");
      } else {
        toast.error(`End-event failed: ${raw.slice(0, 160)}`);
      }
      console.error("completeBounty failed:", e);
    } finally {
      setBusy(false);
    }
  }

  async function checkInParticipant(bountyId: string, walletAddress: string) {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("bounty-checkin", {
        body: { bountyId, walletAddress },
      });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      toast.success("Checked in on-chain");
      await qc.invalidateQueries({ queryKey: ["bounty-signups"] });
      return data;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Check-in failed");
      throw e;
    } finally {
      setBusy(false);
    }
  }

  async function addParticipant(onChainId: number, addr: string, bountyRowId?: string) {
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
      if (bountyRowId) {
        const { data: { user } } = await supabase.auth.getUser();
        await supabase
          .from("bounty_signups")
          .update({
            status: "checked_in",
            added_tx_hash: transactionHash,
            added_at: new Date().toISOString(),
            checked_in_at: new Date().toISOString(),
            added_by: user?.id ?? null,
          })
          .eq("bounty_id", bountyRowId)
          .ilike("wallet_address", addr);
      }
      toast.success("Participant added");
      await qc.invalidateQueries({ queryKey: ["bounties"] });
      await qc.invalidateQueries({ queryKey: ["bounty-signups"] });
    } finally {
      setBusy(false);
    }
  }

  return { busy, preflight, createBounty, completeBounty, addParticipant, startEvent, checkInParticipant };
}

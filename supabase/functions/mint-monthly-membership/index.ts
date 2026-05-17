// Issues/renews a soulbound MembershipNFT for a donor and mints 1 vPURPOSE
// (1 active NFT = 1 vote). Stamps the currently-active edition onto the mint row.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  parseUnits,
  decodeEventLog,
} from "https://esm.sh/viem@2.21.0";
import { privateKeyToAccount } from "https://esm.sh/viem@2.21.0/accounts";
import { base } from "https://esm.sh/viem@2.21.0/chains";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const MIN_DONATION_USDC = 5;
const MONTH_SECONDS = 31n * 24n * 60n * 60n; // 31 days
const VPURPOSE_PER_PASS = parseUnits("1", 18); // 1 vPURPOSE per active pass

const MEMBERSHIP_ABI = parseAbi([
  "function tokenOf(address) view returns (uint256)",
  "function issue(address to, uint256 durationSeconds) returns (uint256)",
  "function renew(address wallet, uint256 durationSeconds)",
  "event MembershipIssued(address indexed wallet, uint256 indexed tokenId, uint256 expiresAt)",
]);

const VPURPOSE_ABI = parseAbi([
  "function mint(address to, uint256 amount)",
]);

function monthKeyFromDate(d: Date): number {
  return d.getUTCFullYear() * 100 + (d.getUTCMonth() + 1);
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { donation_id } = await req.json();
    if (!donation_id) return json({ error: "donation_id required" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: donation, error: dErr } = await supabase
      .from("donations")
      .select("id, donor_wallet, amount_usdc, created_at, status")
      .eq("id", donation_id)
      .maybeSingle();
    if (dErr || !donation) return json({ error: "donation not found" }, 404);

    if (Number(donation.amount_usdc) < MIN_DONATION_USDC) {
      return json({ skipped: true, reason: "below_minimum" });
    }

    const wallet = donation.donor_wallet as string;
    if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
      return json({ error: "bad donor_wallet" }, 400);
    }

    const monthKey = monthKeyFromDate(new Date(donation.created_at));

    const { data: existing } = await supabase
      .from("membership_mints")
      .select("id, status, token_id")
      .eq("donor_wallet", wallet)
      .eq("month_key", monthKey)
      .maybeSingle();
    if (existing && existing.status === "minted") {
      return json({ already_minted: true, mint: existing });
    }

    const membershipAddr = Deno.env.get("MEMBERSHIP_NFT_ADDRESS") as
      | `0x${string}`
      | undefined;
    const vpurposeAddr = (Deno.env.get("VPURPOSE_TOKEN_ADDRESS") ??
      "0x437718C580C109610Bc5a74A439a7Fb6ad83835e") as `0x${string}`;
    const pk = Deno.env.get("BOUNTY_ADMIN_PRIVATE_KEY");

    // Look up currently active edition (stamp at mint time)
    const { data: activeEdition } = await supabase
      .from("membership_editions")
      .select("id")
      .eq("active", true)
      .maybeSingle();
    const editionId = activeEdition?.id ?? null;

    // No contract yet — fall back to legacy "pending_contract" insert
    if (!membershipAddr || !pk) {
      if (existing) return json({ mint: existing, skipped: true });
      const { data: inserted, error: iErr } = await supabase
        .from("membership_mints")
        .insert({
          donor_wallet: wallet,
          month_key: monthKey,
          contract_address: membershipAddr ?? null,
          edition_id: editionId,
          status: "pending_contract",
        })
        .select()
        .single();
      if (iErr) throw iErr;
      return json({ ok: true, mint: inserted, on_chain: false });
    }

    const account = privateKeyToAccount(
      (pk.startsWith("0x") ? pk : `0x${pk}`) as `0x${string}`,
    );
    const publicClient = createPublicClient({ chain: base, transport: http() });
    const walletClient = createWalletClient({ chain: base, transport: http(), account });

    // issue() if no token, renew() if already has one
    const currentTokenId = (await publicClient.readContract({
      address: membershipAddr,
      abi: MEMBERSHIP_ABI,
      functionName: "tokenOf",
      args: [wallet as `0x${string}`],
    })) as bigint;

    let tokenId: bigint;
    let txHash: `0x${string}`;
    const isNewMint = currentTokenId === 0n;

    if (isNewMint) {
      txHash = await walletClient.writeContract({
        address: membershipAddr,
        abi: MEMBERSHIP_ABI,
        functionName: "issue",
        args: [wallet as `0x${string}`, MONTH_SECONDS],
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      // Pull tokenId from MembershipIssued event
      tokenId = 0n;
      for (const log of receipt.logs) {
        try {
          const decoded = decodeEventLog({
            abi: MEMBERSHIP_ABI,
            data: log.data,
            topics: log.topics,
          });
          if (decoded.eventName === "MembershipIssued") {
            tokenId = (decoded.args as { tokenId: bigint }).tokenId;
            break;
          }
        } catch {
          /* not our event */
        }
      }
      if (tokenId === 0n) {
        // Fallback: re-read tokenOf
        tokenId = (await publicClient.readContract({
          address: membershipAddr,
          abi: MEMBERSHIP_ABI,
          functionName: "tokenOf",
          args: [wallet as `0x${string}`],
        })) as bigint;
      }
    } else {
      txHash = await walletClient.writeContract({
        address: membershipAddr,
        abi: MEMBERSHIP_ABI,
        functionName: "renew",
        args: [wallet as `0x${string}`, MONTH_SECONDS],
      });
      await publicClient.waitForTransactionReceipt({ hash: txHash });
      tokenId = currentTokenId;
    }

    // Mint 1 vPURPOSE per pass on first issuance only (renewals already hold it).
    let vpurposeTxHash: `0x${string}` | null = null;
    if (isNewMint) {
      try {
        vpurposeTxHash = await walletClient.writeContract({
          address: vpurposeAddr,
          abi: VPURPOSE_ABI,
          functionName: "mint",
          args: [wallet as `0x${string}`, VPURPOSE_PER_PASS],
        });
        await publicClient.waitForTransactionReceipt({ hash: vpurposeTxHash });
      } catch (e) {
        console.error("vPURPOSE mint failed (continuing)", e);
      }
    }

    // Upsert membership_mints row
    const row = {
      donor_wallet: wallet,
      month_key: monthKey,
      contract_address: membershipAddr,
      edition_id: editionId,
      token_id: Number(tokenId),
      tx_hash: txHash,
      status: "minted",
      updated_at: new Date().toISOString(),
    };

    const { data: saved, error: sErr } = existing
      ? await supabase
          .from("membership_mints")
          .update(row)
          .eq("id", existing.id)
          .select()
          .single()
      : await supabase
          .from("membership_mints")
          .insert(row)
          .select()
          .single();
    if (sErr) throw sErr;

    return json({
      ok: true,
      mint: saved,
      on_chain: true,
      token_id: Number(tokenId),
      tx_hash: txHash,
      vpurpose_tx_hash: vpurposeTxHash,
      action: isNewMint ? "issued" : "renewed",
    });
  } catch (e) {
    console.error("mint-monthly-membership error", e);
    return json({ error: e instanceof Error ? e.message : "failed" }, 500);
  }
});

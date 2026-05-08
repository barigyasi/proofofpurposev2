// Sync on-chain USDC donations to the Donation Split contract on Base.
// Admin-only. Scans `Transfer(from, to=DONATION_SPLIT, value)` logs in chunks
// and upserts into public.donations keyed by (tx_hash, log_index).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RPC = "https://mainnet.base.org";
const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913".toLowerCase();
const DONATION_SPLIT = "0x214aF142ff6D9f150EF994e0ea32Ba1f8db9C8dC".toLowerCase();
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
// USDC on Base launched ~Aug 2023; pick a recent-ish floor so first sync is fast.
// Adjust if you need to backfill earlier.
const DEFAULT_START_BLOCK = 19_000_000n;
const CHUNK = 2000n;

function pad32(addr: string) {
  return "0x" + addr.replace(/^0x/, "").toLowerCase().padStart(64, "0");
}

async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  let attempt = 0;
  while (true) {
    const res = await fetch(RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    });
    const json = await res.json().catch(() => ({}));
    const errMsg: string = json?.error?.message ?? "";
    const isRateLimit =
      res.status === 429 || /rate limit|too many requests/i.test(errMsg);
    if (isRateLimit && attempt < 5) {
      attempt++;
      await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
      continue;
    }
    if (json.error) throw new Error(`${method}: ${errMsg || JSON.stringify(json.error)}`);
    return json.result as T;
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) return json({ error: "Forbidden" }, 403);

    // Resume point: max block_number already stored (+1), or default floor.
    const { data: latest } = await admin
      .from("donations")
      .select("block_number")
      .not("block_number", "is", null)
      .order("block_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    const startFromBody = await req.json().catch(() => ({}));
    const overrideFrom = typeof startFromBody?.fromBlock === "number"
      ? BigInt(startFromBody.fromBlock)
      : null;

    const head = BigInt(await rpc<string>("eth_blockNumber", []));
    let from = overrideFrom
      ?? (latest?.block_number ? BigInt(latest.block_number) + 1n : DEFAULT_START_BLOCK);
    if (from > head) return json({ inserted: 0, scannedFrom: from.toString(), head: head.toString() });

    const rows: Array<{
      donor_wallet: string;
      amount_usdc: number;
      tx_hash: string;
      block_number: number;
      log_index: number;
      source: string;
      status: string;
    }> = [];

    while (from <= head) {
      const to = from + CHUNK - 1n > head ? head : from + CHUNK - 1n;
      const logs = await rpc<Array<{
        address: string;
        topics: string[];
        data: string;
        transactionHash: string;
        blockNumber: string;
        logIndex: string;
      }>>("eth_getLogs", [{
        fromBlock: "0x" + from.toString(16),
        toBlock: "0x" + to.toString(16),
        address: USDC,
        topics: [TRANSFER_TOPIC, null, pad32(DONATION_SPLIT)],
      }]);

      for (const log of logs) {
        const fromAddr = "0x" + log.topics[1].slice(26).toLowerCase();
        const value = BigInt(log.data); // uint256
        const amount = Number(value) / 1e6;
        rows.push({
          donor_wallet: fromAddr,
          amount_usdc: amount,
          tx_hash: log.transactionHash.toLowerCase(),
          block_number: Number(BigInt(log.blockNumber)),
          log_index: Number(BigInt(log.logIndex)),
          source: "onchain",
          status: "confirmed",
        });
      }

      from = to + 1n;
    }

    let inserted = 0;
    if (rows.length) {
      const { data, error } = await admin
        .from("donations")
        .upsert(rows, { onConflict: "tx_hash,log_index", ignoreDuplicates: true })
        .select("id");
      if (error) throw error;
      inserted = data?.length ?? 0;
    }

    return json({
      inserted,
      scanned: rows.length,
      head: head.toString(),
    });
  } catch (e) {
    console.error("sync-donations error", e);
    return json({ error: e instanceof Error ? e.message : "Failed" }, 500);
  }
});

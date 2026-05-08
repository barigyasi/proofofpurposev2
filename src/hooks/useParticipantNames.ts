import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Input {
  user_id?: string | null;
  wallet_address: string;
}

/** Resolves friendly names for a list of bounty signups / participants.
 *  Returns a map keyed by lowercased wallet address → display name (or null). */
export function useParticipantNames(rows: Input[]) {
  const [names, setNames] = useState<Map<string, string>>(new Map());

  // Stable key so the effect only re-runs when the actual id/wallet set changes.
  const key = rows
    .map((r) => `${r.user_id ?? ""}|${r.wallet_address.toLowerCase()}`)
    .sort()
    .join(",");

  useEffect(() => {
    let cancelled = false;
    if (!rows.length) {
      setNames(new Map());
      return;
    }

    (async () => {
      const userIds = Array.from(
        new Set(rows.map((r) => r.user_id).filter((x): x is string => !!x)),
      );
      const wallets = Array.from(
        new Set(rows.map((r) => r.wallet_address.toLowerCase())),
      );

      const [champRes, profRes, vendorRes, catalystRes] = await Promise.all([
        userIds.length
          ? supabase
              .from("champion_applications")
              .select("user_id, wallet_address, champion_name, status")
              .in("user_id", userIds)
          : Promise.resolve({ data: [] as never[], error: null }),
        userIds.length
          ? supabase
              .from("profiles")
              .select("id, wallet_address, display_name, username")
              .in("id", userIds)
          : Promise.resolve({ data: [] as never[], error: null }),
        wallets.length
          ? supabase
              .from("vendors")
              .select("wallet_address, business_name")
              .in("wallet_address", wallets)
          : Promise.resolve({ data: [] as never[], error: null }),
        wallets.length
          ? supabase
              .from("catalyst_orgs")
              .select("wallet_address, org_name")
              .in("wallet_address", wallets)
          : Promise.resolve({ data: [] as never[], error: null }),
      ]);

      if (cancelled) return;

      const map = new Map<string, string>();
      // Lowest priority first so higher-priority sources overwrite.
      for (const v of (vendorRes.data ?? []) as Array<{ wallet_address: string; business_name: string }>) {
        if (v.business_name) map.set(v.wallet_address.toLowerCase(), v.business_name);
      }
      for (const c of (catalystRes.data ?? []) as Array<{ wallet_address: string; org_name: string }>) {
        if (c.org_name) map.set(c.wallet_address.toLowerCase(), c.org_name);
      }
      for (const p of (profRes.data ?? []) as Array<{ id: string; wallet_address: string; display_name: string | null; username: string | null }>) {
        const name = p.display_name || p.username;
        if (name && p.wallet_address) map.set(p.wallet_address.toLowerCase(), name);
      }
      // Champions are highest priority — most bounty signups are champions.
      const approvedFirst = ((champRes.data ?? []) as Array<{ user_id: string; wallet_address: string; champion_name: string; status: string }>)
        .sort((a, b) => (a.status === "approved" ? -1 : 1) - (b.status === "approved" ? -1 : 1));
      for (const c of approvedFirst) {
        if (c.champion_name && c.wallet_address) {
          map.set(c.wallet_address.toLowerCase(), c.champion_name);
        }
      }

      setNames(map);
    })();

    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return names;
}

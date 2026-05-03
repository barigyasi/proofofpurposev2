import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Status = "loading" | "none" | "pending" | "approved";

export function useVendorApplication(walletAddress?: string) {
  const [status, setStatus] = useState<Status>("loading");
  const [businessName, setBusinessName] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!walletAddress) {
      setStatus("none");
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("vendors")
        .select("approved,business_name")
        .ilike("wallet_address", walletAddress)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      if (!data) setStatus("none");
      else {
        setStatus(data.approved ? "approved" : "pending");
        setBusinessName(data.business_name ?? null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [walletAddress]);

  return { status, businessName };
}

export function useCatalystApplication(userId?: string) {
  const [status, setStatus] = useState<Status>("loading");
  const [orgName, setOrgName] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!userId) {
      setStatus("none");
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("catalyst_orgs")
        .select("approved,org_name")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      if (!data) setStatus("none");
      else {
        setStatus(data.approved ? "approved" : "pending");
        setOrgName(data.org_name ?? null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return { status, orgName };
}

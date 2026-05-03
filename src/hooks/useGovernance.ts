import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useGovernanceConfig() {
  return useQuery({
    queryKey: ["governance-config"],
    queryFn: async () => {
      const { data } = await supabase
        .from("governance_config")
        .select("vote_contract_address, vote_token_address")
        .eq("id", 1)
        .maybeSingle();
      return data ?? { vote_contract_address: null, vote_token_address: null };
    },
  });
}

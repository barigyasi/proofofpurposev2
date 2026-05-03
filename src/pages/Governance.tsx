import { useEffect, useState } from "react";
import { useGovernanceConfig } from "@/hooks/useGovernance";
import { supabase } from "@/integrations/supabase/client";

type Draft = {
  id: string;
  name: string;
  description: string | null;
  reward_purpose: number;
  max_participants: number;
  status: string;
  dao_proposal_id: number | null;
};

export default function Governance() {
  const { data: gov } = useGovernanceConfig();
  const [drafts, setDrafts] = useState<Draft[]>([]);

  useEffect(() => {
    supabase
      .from("bounty_drafts")
      .select("id,name,description,reward_purpose,max_participants,status,dao_proposal_id")
      .order("created_at", { ascending: false })
      .then(({ data }) => setDrafts((data ?? []) as Draft[]));
  }, []);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="border-b-2 border-foreground pb-6">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          // proof of purpose · dao
        </p>
        <h1 className="mt-2 font-display text-5xl">GOVERNANCE</h1>
        <p className="mt-3 max-w-prose text-sm text-muted-foreground">
          Donors, Catalysts, and the super admin vote on which bounties go live. Voting weight
          comes from on-chain participation in Proof of Purpose.
        </p>
      </div>

      {!gov?.vote_contract_address ? (
        <div className="brutal mt-8 p-6">
          <h2 className="font-display text-2xl">DAO COMING SOON</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            The vote contract isn't configured yet. Catalysts can still queue drafts; the super
            admin posts approved bounties on-chain in the meantime.
          </p>
        </div>
      ) : (
        <div className="mt-8 space-y-3">
          {drafts.map((d) => (
            <div key={d.id} className="brutal p-4">
              <p className="font-mono text-[10px] uppercase text-primary">{d.status}</p>
              <h3 className="mt-1 font-display text-xl">{d.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{d.description}</p>
              <p className="mt-2 font-display text-primary">
                {d.reward_purpose} PURPOSE × {d.max_participants}
              </p>
              {/* Vote / execute UI goes here once contract is live */}
            </div>
          ))}
        </div>
      )}

      <p className="mt-10 font-mono text-[10px] text-muted-foreground">
        // contract: {gov?.vote_contract_address ?? "(not set)"}
      </p>
    </main>
  );
}

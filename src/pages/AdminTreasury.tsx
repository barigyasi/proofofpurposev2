import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getContract, readContract } from "thirdweb";
import { useSessionRoles } from "@/hooks/useSessionRoles";
import { thirdwebClient, baseChain } from "@/lib/thirdweb";
import { ACTIVE, USDC_DECIMALS } from "@/config/contracts";
import { formatPurpose } from "@/hooks/usePurposeBalance";

export default function AdminTreasury() {
  const navigate = useNavigate();
  const { session, roles, isLoading } = useSessionRoles();
  const [usdc, setUsdc] = useState<bigint | null>(null);
  const [supply, setSupply] = useState<bigint | null>(null);

  useEffect(() => {
    if (isLoading) return;
    if (!session || !roles.includes("admin")) navigate("/", { replace: true });
  }, [isLoading, session, roles, navigate]);

  useEffect(() => {
    if (!roles.includes("admin")) return;
    (async () => {
      const usdcC = getContract({ client: thirdwebClient, chain: baseChain, address: ACTIVE.USDC });
      const purposeC = getContract({ client: thirdwebClient, chain: baseChain, address: ACTIVE.PURPOSE_TOKEN });
      const [u, s] = await Promise.all([
        readContract({ contract: usdcC, method: "function balanceOf(address) view returns (uint256)", params: [ACTIVE.TREASURY as `0x${string}`] }) as Promise<bigint>,
        readContract({ contract: purposeC, method: "function totalSupply() view returns (uint256)", params: [] }) as Promise<bigint>,
      ]);
      setUsdc(u);
      setSupply(s);
    })();
  }, [roles]);

  if (!roles.includes("admin")) return null;
  const usdcStr = usdc != null ? (Number(usdc) / 10 ** USDC_DECIMALS).toFixed(2) : "…";

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="border-b-2 border-foreground pb-6">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">// admin</p>
        <h1 className="mt-2 font-display text-5xl">TREASURY</h1>
      </div>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="brutal p-6">
          <p className="font-mono text-[10px] uppercase text-muted-foreground">treasury USDC</p>
          <p className="mt-2 font-display text-4xl text-primary">${usdcStr}</p>
          <a className="mt-2 inline-block font-mono text-[10px] text-primary underline"
            target="_blank" rel="noreferrer"
            href={`https://basescan.org/address/${ACTIVE.TREASURY}`}>view ↗</a>
        </div>
        <div className="brutal p-6">
          <p className="font-mono text-[10px] uppercase text-muted-foreground">$PURPOSE supply</p>
          <p className="mt-2 font-display text-4xl text-primary">{supply ? formatPurpose(supply) : "…"}</p>
          <a className="mt-2 inline-block font-mono text-[10px] text-primary underline"
            target="_blank" rel="noreferrer"
            href={`https://basescan.org/address/${ACTIVE.PURPOSE_TOKEN}`}>view ↗</a>
        </div>
      </div>
    </main>
  );
}

import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { CONTRACTS_V2 } from "@/config/contracts";
import { fetchReceipt, type DecodedReceipt } from "@/lib/receipts";

export default function Receipt() {
  const { tokenId } = useParams<{ tokenId: string }>();
  const [data, setData] = useState<DecodedReceipt | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tokenId) return;
    if (!CONTRACTS_V2.RECEIPT_NFT) { setError("Receipt contract not yet live"); return; }
    fetchReceipt(tokenId)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load receipt"));
  }, [tokenId]);

  useEffect(() => { document.title = `POP Receipt #${tokenId ?? ""} — Proof of Purpose`; }, [tokenId]);

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">// public receipt</p>
      <h1 className="mt-3 font-display text-5xl">RECEIPT <span className="text-primary">#{tokenId}</span></h1>

      <div className="brutal mt-8 aspect-square w-full overflow-hidden">
        {error ? (
          <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
            {error}
          </div>
        ) : !data?.svg ? (
          <div className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">Loading…</div>
        ) : (
          <div className="h-full w-full [&>svg]:h-full [&>svg]:w-full"
               dangerouslySetInnerHTML={{ __html: data.svg }} />
        )}
      </div>

      {CONTRACTS_V2.RECEIPT_NFT && (
        <p className="mt-4 text-center font-mono text-[10px] uppercase tracking-widest">
          <a className="text-primary underline"
             href={`https://basescan.org/token/${CONTRACTS_V2.RECEIPT_NFT}?a=${tokenId}`}
             target="_blank" rel="noreferrer">
            verify on basescan ↗
          </a>
        </p>
      )}

      <div className="mt-6 text-center">
        <Link to="/" className="font-mono text-xs uppercase tracking-widest text-muted-foreground underline">
          ← back to proof of purpose
        </Link>
      </div>
    </main>
  );
}

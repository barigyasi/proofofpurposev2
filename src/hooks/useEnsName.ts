import { useEffect, useState } from "react";
import { createPublicClient, http, isAddress, normalize } from "viem";
import { mainnet } from "viem/chains";

const mainnetClient = createPublicClient({ chain: mainnet, transport: http() });

// In-memory cache so re-renders / multiple components sharing an address only resolve once.
const cache = new Map<string, string | null>();
const inflight = new Map<string, Promise<string | null>>();

async function lookup(address: string): Promise<string | null> {
  const key = address.toLowerCase();
  if (cache.has(key)) return cache.get(key)!;
  if (inflight.has(key)) return inflight.get(key)!;

  const p = (async () => {
    try {
      const name = await mainnetClient.getEnsName({ address: address as `0x${string}` });
      if (!name) {
        cache.set(key, null);
        return null;
      }
      // Forward-resolve to confirm the reverse record matches (prevents spoofing).
      const forward = await mainnetClient.getEnsAddress({ name: normalize(name) });
      const verified = forward && forward.toLowerCase() === key ? name : null;
      cache.set(key, verified);
      return verified;
    } catch {
      cache.set(key, null);
      return null;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, p);
  return p;
}

/** Returns the verified ENS name for an EVM address, or null. */
export function useEnsName(address?: string | null): string | null {
  const [name, setName] = useState<string | null>(() => {
    if (!address || !isAddress(address)) return null;
    return cache.get(address.toLowerCase()) ?? null;
  });

  useEffect(() => {
    if (!address || !isAddress(address)) {
      setName(null);
      return;
    }
    let cancelled = false;
    lookup(address).then((n) => {
      if (!cancelled) setName(n);
    });
    return () => {
      cancelled = true;
    };
  }, [address]);

  return name;
}

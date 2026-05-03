import { createPublicClient, createWalletClient, http } from "https://esm.sh/viem@2.21.45";
import { privateKeyToAccount } from "https://esm.sh/viem@2.21.45/accounts";
import { base } from "https://esm.sh/viem@2.21.45/chains";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const WALLET_RE = /^0x[a-fA-F0-9]{40}$/;
const BOUNTY_MANAGER = "0x0F2Cf105534657b954169CeD15f3294E19350a51" as const;

const ABI = [
  {
    inputs: [
      { name: "bountyId", type: "uint256" },
      { name: "participant", type: "address" },
    ],
    name: "addParticipant",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "bountyId", type: "uint256" }],
    name: "getParticipants",
    outputs: [{ name: "", type: "address[]" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { bountyId, walletAddress } = await req.json();
    if (
      typeof bountyId !== "number" ||
      typeof walletAddress !== "string" ||
      !WALLET_RE.test(walletAddress)
    ) {
      return json({ error: "Invalid input" }, 400);
    }

    const pk = Deno.env.get("BOUNTY_ADMIN_PRIVATE_KEY");
    if (!pk) {
      return json(
        {
          error:
            "Self-signup not yet supported on the deployed BountyManager. An admin must add you, or wait for the redeploy that exposes signUpForBounty().",
        },
        501,
      );
    }

    const rpc = "https://mainnet.base.org";
    const publicClient = createPublicClient({ chain: base, transport: http(rpc) });

    // Defensive check: avoid duplicate signup (the on-chain tx would revert anyway)
    const participants = (await publicClient.readContract({
      address: BOUNTY_MANAGER,
      abi: ABI,
      functionName: "getParticipants",
      args: [BigInt(bountyId)],
    })) as readonly string[];
    const lower = walletAddress.toLowerCase();
    if (participants.some((p) => p.toLowerCase() === lower)) {
      return json({ error: "Already signed up" }, 400);
    }

    const account = privateKeyToAccount(pk as `0x${string}`);
    const walletClient = createWalletClient({
      account,
      chain: base,
      transport: http(rpc),
    });
    const hash = await walletClient.writeContract({
      address: BOUNTY_MANAGER,
      abi: ABI,
      functionName: "addParticipant",
      args: [BigInt(bountyId), walletAddress as `0x${string}`],
    });

    return json({ ok: true, hash });
  } catch (e) {
    console.error("bounty-signup error", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

import { createThirdwebClient } from "thirdweb";
import { base } from "thirdweb/chains";
import { inAppWallet, createWallet } from "thirdweb/wallets";

// Public client ID — safe to ship in the bundle.
const THIRDWEB_CLIENT_ID =
  import.meta.env.VITE_THIRDWEB_CLIENT_ID ?? "0f6689ee21b2280f8ec05ad7986716e2";

export const thirdwebClient = createThirdwebClient({
  clientId: THIRDWEB_CLIENT_ID,
});

export const baseChain = base;

// Smart accounts on Base, sponsored gas
export const accountAbstraction = {
  chain: base,
  sponsorGas: true,
} as const;

export const wallets = [
  inAppWallet({
    auth: {
      options: ["email", "google", "apple", "passkey"],
    },
    smartAccount: accountAbstraction,
  }),
  createWallet("io.metamask"),
  createWallet("com.coinbase.wallet"),
  createWallet("walletConnect"),
];

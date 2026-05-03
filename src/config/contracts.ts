// Proof of Purpose — Base Mainnet contract addresses
// chainId 8453

export const CHAIN_ID = 8453 as const;

export const CONTRACTS = {
  PURPOSE_TOKEN: "0x8aA9b99B90bf5A0EEc0DDd0C590E2f817875EdeD",
  VENDOR_REDEMPTION: "0x33910B1dF118D8465eC727cd3B9d82b6dF5c229E",
  BOUNTY_MANAGER: "0x0F2Cf105534657b954169CeD15f3294E19350a51",
  TREASURY: "0xB452b6A36954fafB0342220B2C7a6c47925Eec44",
  USDC_BASE: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  DONATION_SPLIT: "0x214aF142ff6D9f150EF994e0ea32Ba1f8db9C8dC",
} as const;

// 1 PURPOSE (18 decimals) = 1 USDC (6 decimals); on-chain rate = amount / 1e12
export const PURPOSE_DECIMALS = 18;
export const USDC_DECIMALS = 6;

// Admin allowlist — auto-granted admin role on first wallet login (resolved server-side).
export const ADMIN_ALLOWLIST = [
  "0xa5a484Af10FF67257A06DDbf8DdE6A99a483f098",
  "gyasi.eth",
] as const;

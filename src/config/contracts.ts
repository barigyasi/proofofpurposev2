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
  TEAM_SPLIT: "0xa0FA4787921f9A9253810D27333031Ae2D62E334",
} as const;

// 0xSplits sentinel address used to represent native ETH in distribute(token).
export const NATIVE_TOKEN_SENTINEL =
  "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE" as const;

/**
 * V2 contract addresses — populate after redeploying PurposeTokenV2 / BountyManagerV2 /
 * VendorRedemptionV2 / RefundPool. While these are zero, the V2 settlement edge
 * functions short-circuit (return 503) and the app continues to use V1.
 */
export const CONTRACTS_V2 = {
  PURPOSE_TOKEN: "0xd9a710A1ED0b73f487C4cF55580B71bBfc6B869f",
  VENDOR_REDEMPTION: "0x54e60C53d3ec7F25fc4cc9e1426b181C455F7c25",
  BOUNTY_MANAGER: "0x19cabb84B1A05D89f5F43D6f589b31dbAfd0F352",
  REFUND_POOL: "0x8E1f67018ED9545a9A1eb5Fd596D51f04BB217d3",
  RECEIPT_NFT: "0xeCC53349Df9a6739b8330547D57F0986d073EE52",
  VPURPOSE_TOKEN: "0x437718C580C109610Bc5a74A439a7Fb6ad83835e",
  POP_GOVERNOR: "0x137CDAE27838Ddb13572dDDf6bb13E982D968E97",
  MEMBERSHIP_NFT: "0x1FcCF25f5DA8FAE4789746a412A92B0CaD5D2743",
} as const;

export const V2_LIVE = Boolean(CONTRACTS_V2.VENDOR_REDEMPTION) && Boolean(CONTRACTS_V2.PURPOSE_TOKEN);

/**
 * Single source of truth for "the live contract addresses the app should read from".
 * Flips to V2 the moment V2_LIVE is true.
 */
export const ACTIVE = {
  PURPOSE_TOKEN: V2_LIVE ? CONTRACTS_V2.PURPOSE_TOKEN : CONTRACTS.PURPOSE_TOKEN,
  BOUNTY_MANAGER: V2_LIVE ? CONTRACTS_V2.BOUNTY_MANAGER : CONTRACTS.BOUNTY_MANAGER,
  VENDOR_REDEMPTION: V2_LIVE ? CONTRACTS_V2.VENDOR_REDEMPTION : CONTRACTS.VENDOR_REDEMPTION,
  TREASURY: CONTRACTS.TREASURY,
  USDC: CONTRACTS.USDC_BASE,
  DONATION_SPLIT: CONTRACTS.DONATION_SPLIT,
  TEAM_SPLIT: CONTRACTS.TEAM_SPLIT,
} as const;

/** Minimum recommended PURPOSE per participant for new bounties. */
export const MIN_RECOMMENDED_REWARD = 25;

// 1 PURPOSE (18 decimals) = 1 USDC (6 decimals); on-chain rate = amount / 1e12
export const PURPOSE_DECIMALS = 18;
export const USDC_DECIMALS = 6;

// Admin allowlist — auto-granted admin role on first wallet login (resolved server-side).
export const ADMIN_ALLOWLIST = [
  "0xa5a484Af10FF67257A06DDbf8DdE6A99a483f098",
  "gyasi.eth",
] as const;

# Proof of Purpose — V2 contracts

Drop-in replacements for the live PurposeToken / BountyManager / VendorRedemption
that make PURPOSE behave as a **soulbound community credit**: peer-to-peer
transfers are blocked, but mint, burn, and transfers touching a whitelisted
system address (VendorRedemption, Treasury, future migration helper) still work.

## Files

| File                       | Replaces (V1)        | Notes                                   |
|----------------------------|----------------------|-----------------------------------------|
| `PurposeTokenV2.sol`       | PURPOSE ERC20        | Restricted-transfer + AccessControl + ERC20Permit |
| `BountyManagerV2.sol`      | BountyManager        | Same surface; new constructor takes V2 token |
| `VendorRedemptionV2.sol`   | VendorRedemption     | Same surface; uses `burnFrom` (requires champion `approve`) |

## OpenZeppelin version

Compiled against **@openzeppelin/contracts v5.x**. In Remix:

```
github.com/OpenZeppelin/openzeppelin-contracts/blob/release-v5.0/contracts/...
```

In Foundry:

```
forge install OpenZeppelin/openzeppelin-contracts@v5.0.2
```

Solidity: `0.8.24` or later.

## Deploy order (Base mainnet)

1. **Deploy `PurposeTokenV2(admin)`** — `admin` = your admin EOA
   (`0xa5a484Af10FF67257A06DDbf8DdE6A99a483f098`).
2. **Deploy `BountyManagerV2(admin, purposeV2)`**.
3. From admin, on PurposeTokenV2: `grantRole(MINTER_ROLE, bountyManagerV2)`.
4. **Deploy `VendorRedemptionV2(admin, purposeV2, usdc, treasury)`** —
   - `usdc` = `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` (Base USDC)
   - `treasury` = current treasury address.
5. From admin, on PurposeTokenV2: `setTransferAllowedBatch([vendorRedemptionV2, treasury], true)`.
   (Add the BountyManager too if you ever want to refund/clawback to it.)
6. From treasury wallet: `usdc.approve(vendorRedemptionV2, max)` so the
   redemption contract can pull USDC payouts.
7. From admin, on VendorRedemptionV2: `grantRole(SETTLEMENT_ROLE, backendSignerAddress)`
   — this is the hot key the edge function uses to call `redeemFor(vendor, champion, amount)`
   after a champion confirms a POS charge or online-shop checkout. Lovable will
   request a `REDEMPTION_SIGNER_PRIVATE_KEY` secret when wiring V2.

## After deploy — what to send back

Paste the four addresses in chat:

```
PURPOSE_V2=0x...
BOUNTY_MANAGER_V2=0x...
VENDOR_REDEMPTION_V2=0x...
TREASURY=0x...   # unchanged unless you rotated it
```

Lovable will then update `src/config/contracts.ts` + the ABIs under
`src/contracts/abis/` and wire the new POS / online-shop flows.

## Champion approval requirement

Because V2 uses `burnFrom`, every champion must give VendorRedemptionV2 an
ERC20 allowance once before their first redemption. The frontend will handle
this transparently via a sponsored-gas `approve(VendorRedemption, max)` from
the smart wallet on first checkout — invisible beyond a brief
"preparing wallet…" toast.

## What is NOT soulbound-enforced

- Mints, burns, and any transfer to/from a whitelisted address are allowed by
  design — that's how rewards and redemptions work.
- The `transferAllowed` whitelist is mutable by `TRANSFER_ADMIN_ROLE`. Keep
  that role on a multisig long-term.

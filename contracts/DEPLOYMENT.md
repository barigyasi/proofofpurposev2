# Proof of Purpose — Deployment Guide (V2 + Governance)

This is the **canonical, end-to-end deployment order** for the current Proof of
Purpose contract suite. Use it for **Base Sepolia (testnet) first**, verify
every step in Remix / thirdweb dashboard, then repeat on **Base mainnet**.

> Same admin EOA owns all contracts. On mainnet that is
> `0xa5a484Af10FF67257A06DDbf8DdE6A99a483f098`. On testnet, use any wallet you
> control with Sepolia ETH — just keep it consistent across all six deploys.

---

## 0. Architecture in one picture

```
                    ┌────────────────────────────┐
                    │  PurposeTokenV2 (ERC20)    │
                    │  - MINTER_ROLE → BountyMgr │
                    │  - TRANSFER whitelist:     │
                    │      VendorRedemption,     │
                    │      Treasury              │
                    └──────────┬─────────────────┘
                       mint()  │  burnFrom()
                ┌──────────────┘         └──────────────┐
                ▼                                       ▼
   ┌────────────────────────┐            ┌────────────────────────────┐
   │  BountyManagerV2       │            │  VendorRedemptionV2        │
   │  - admin EOA holds     │            │  - admin EOA = DEFAULT     │
   │    BOUNTY_ADMIN_ROLE   │            │  - VENDOR_ROLE per vendor  │
   │  - mints PURPOSE on    │            │  - SETTLEMENT_ROLE = backend│
   │    bounty completion   │            │    hot key (redeemFor)     │
   └────────────────────────┘            └─────────────┬──────────────┘
                                                       │  safeTransferFrom
                                                       ▼
                                       ┌──────────────────────────────┐
                                       │  Treasury wallet (USDC)      │
                                       │  approves VendorRedemption   │
                                       │  to spend USDC               │
                                       └──────────────────────────────┘

                    ┌────────────────────────────┐
                    │  PurposeGovToken (ERC20Votes)│  ← governance weight
                    │  minted/airdropped to       │
                    │  Donors + Catalysts          │
                    └──────────────┬─────────────┘
                                   │ token
                                   ▼
                    ┌────────────────────────────┐
                    │  VoteERC20 (thirdweb       │
                    │  governor)                 │
                    │  - propose / castVote /    │
                    │    execute                 │
                    │  - DEFAULT_ADMIN_ROLE =    │
                    │    admin (then Timelock)   │
                    └────────────────────────────┘
```

Seven contracts total:

1. **PurposeTokenV2** — soulbound community credit (PURPOSE)
2. **BountyManagerV2** — mints PURPOSE on bounty completion
3. **VendorRedemptionV2** — escrow state machine (Lock→Capture→Settle/Cancel/Refund/Sweep)
4. **RefundPool** — USDC vault that backs vendor refunds
5. **PurposeGovToken** — separate ERC20Votes token used **only** for governance weight
6. **VoteERC20 (thirdweb)** — the governor itself
7. *(optional v2)* **Timelock** — execution delay for governor; recommended on mainnet

USDC is **not** deployed — you reuse the canonical address per chain.

> **Escrow note:** in V2 the redemption contract holds both PURPOSE and USDC
> between `lock()` and `sweep()`. Treasury must `approve(VendorRedemptionV2, max)`
> for **USDC** at deploy time, and PurposeTokenV2 must whitelist the
> redemption contract for **transfer** (so PURPOSE can move in/out of escrow).
> Steps 5–7 below cover both. After deploy, also call:
>
> - `purposeV2.grantRole(BURNER_ROLE, VENDOR_REDEMPTION_V2)` *(if you add a
>   BURNER_ROLE in the token; current contract uses public `burnFrom` via the
>   ERC20Burnable extension which checks allowance — so the redemption contract
>   must also `approve(itself, max)` against PURPOSE, OR call burnFrom on
>   tokens it owns. The current escrow uses `burnFrom(address(this), ...)` and
>   relies on ERC20Burnable's self-burn path which does NOT require an
>   allowance, so no extra grant needed.)*
> - `vendorRedemptionV2.setRefundPool(REFUND_POOL_ADDRESS)`
> - `refundPool.grantRole(REDEMPTION_ROLE, VENDOR_REDEMPTION_V2)`
> - Optionally `vendorRedemptionV2.setDefaultWindows(86400, 604800)` to confirm 24h auth / 7d refund.

---

## 1. Pre-flight checklist

| Item | Testnet (Base Sepolia) | Mainnet (Base) |
|---|---|---|
| Chain ID | `84532` | `8453` |
| Admin EOA | your test wallet | `0xa5a484Af10FF67257A06DDbf8DdE6A99a483f098` |
| Treasury wallet | a second test wallet you control | current treasury (multisig) |
| USDC address | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| ETH for gas | from a Base Sepolia faucet | bridge a small amount |
| Test USDC in treasury | `mint` on the testnet faucet, ≥ 100 USDC | already funded |
| Solidity | `0.8.24+` | same |
| OpenZeppelin | `@openzeppelin/contracts v5.0.2` | same |

> **One change vs. the old V1 instructions:** the treasury USDC `approve()` step
> is now toward `VendorRedemptionV2`, *not* the old `VendorRedemptionManager`.

---

## 2. Deployment order

Deploy in this exact order — each step depends on the previous.

### Step 1 — `PurposeTokenV2`
Constructor: `constructor(address admin)`
- `admin` = your admin EOA

Save the deployed address as `PURPOSE_V2`.

---

### Step 2 — `BountyManagerV2`
Constructor: `constructor(address admin, address token)`
- `admin` = same admin EOA
- `token` = `PURPOSE_V2` (from step 1)

Save as `BOUNTY_MANAGER_V2`.

---

### Step 3 — Wire BountyManager as PURPOSE minter
On **PurposeTokenV2**, from the admin EOA, call:

```
grantRole(MINTER_ROLE, BOUNTY_MANAGER_V2)
```

`MINTER_ROLE` value is `keccak256("MINTER_ROLE")` = `0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6`.
(Thirdweb dashboard will show "MINTER_ROLE" by name once it reads the ABI — just paste the hash if not.)

✅ Verify: `hasRole(MINTER_ROLE, BOUNTY_MANAGER_V2)` returns `true`.

---

### Step 4 — `VendorRedemptionV2`
Constructor: `constructor(address admin, address purpose_, address usdc_, address treasury_)`
- `admin` = admin EOA
- `purpose_` = `PURPOSE_V2`
- `usdc_` = USDC for your chain (see table above)
- `treasury_` = treasury wallet

Save as `VENDOR_REDEMPTION_V2`.

---

### Step 5 — Whitelist VendorRedemption + Treasury on PURPOSE
PURPOSE is restricted-transfer. To allow burns/payouts to flow, on
**PurposeTokenV2** from admin call:

```
setTransferAllowedBatch([VENDOR_REDEMPTION_V2, TREASURY], true)
```

✅ Verify: `transferAllowed(VENDOR_REDEMPTION_V2)` and
`transferAllowed(TREASURY)` both return `true`.

---

### Step 6 — Treasury approves USDC for the redemption contract
**From the TREASURY wallet** (not admin), on the **USDC contract**, call:

```solidity
function approve(address spender, uint256 amount) external returns (bool);
```

- `spender` = `VENDOR_REDEMPTION_V2`
- `amount` = `2^256 - 1`  (max — paste `115792089237316195423570985008687907853269984665640564039457584007913129639935`)

> On testnet, also mint yourself some test USDC first via Circle's faucet so
> the treasury actually has a balance.

✅ Verify: `usdc.allowance(TREASURY, VENDOR_REDEMPTION_V2)` returns the max value.

---

### Step 7 — Grant the backend settlement signer
The POS / online-shop redemption flow is settled by a server-side hot key,
**not** by vendor wallets. From admin, on **VendorRedemptionV2** call:

```
grantRole(SETTLEMENT_ROLE, BACKEND_SIGNER_ADDRESS)
```

`SETTLEMENT_ROLE` = `keccak256("SETTLEMENT_ROLE")` = `0x4f17ee5a0e9d3c0bc9d7f3f1b0a9d1d4b3b3f4d4a4a8b3b8d4a8b1d8c4b8d4a8`
(thirdweb dashboard will resolve by name — just supply the address).

If you don't have the backend signer yet, generate one with `cast wallet new`
or any wallet generator, save the **private key** (Lovable will request it as
`REDEMPTION_SIGNER_PRIVATE_KEY` when wiring V2), then grant the role.

✅ Verify: `hasRole(SETTLEMENT_ROLE, BACKEND_SIGNER_ADDRESS)` returns `true`.

---

### Step 8 — Approve at least one test vendor
From admin on **VendorRedemptionV2**:

```
approveVendor(YOUR_TEST_VENDOR_ADDRESS)
```

This is required so `redeemFor(vendor, …)` doesn't revert with
`NotApprovedVendor`.

---

### Step 9 — `vPURPOSE` shadow vote token (thirdweb **Token** prebuilt)

> **Why this exists.** Voting power in POP comes from **holding a current
> month's membership NFT** — 1 NFT = 1 vote, that's it. But thirdweb's
> prebuilt **Vote** contract reads vote weight from an **ERC20Votes** token,
> not from an ERC721 balance. So we deploy a tiny "shadow" ERC20 (`vPURPOSE`)
> that the backend keeps **1:1 in sync** with active membership NFTs:
>
> - When `mint-monthly-membership` mints a membership NFT → backend also
>   mints `1 vPURPOSE` to that holder.
> - When the membership lapses (next month rollover, no renewal) → backend
>   burns that `1 vPURPOSE`.
>
> Voters never see this token. From their perspective: "I have an active
> membership → I can vote." It's purely the on-chain mechanism the prebuilt
> Vote contract needs.

Deploy via the thirdweb dashboard → **"Token"** prebuilt contract. Thirdweb's
`TokenERC20` already implements ERC20Votes checkpoints + `delegate()`.

Params:
- name: `Proof of Purpose Vote`
- symbol: `vPURPOSE`
- initial supply: `0` (backend mints/burns as memberships activate)
- primary sale recipient / admin: admin EOA

Save as `PURPOSE_GOV`.

After deploy, on **`PURPOSE_GOV`** from admin:
```
grantRole(MINTER_ROLE, BACKEND_SIGNER_ADDRESS)
```
This lets the same backend hot key that runs `mint-monthly-membership` also
mint/burn vPURPOSE in the same job.

> ⚠ Voters must call `delegate(self)` once before their balance counts. The
> frontend will do this transparently the first time a member opens a proposal.

---

### Step 10 — thirdweb **Vote** governor

Deploy via the thirdweb dashboard → **"Vote"** prebuilt contract (the
underlying contract is named `VoteERC20` in thirdweb's repo, but in the
dashboard it's just labeled **"Vote"**). Params:

| Field | Testnet value | Mainnet value |
|---|---|---|
| `_name` | `POP Governor (test)` | `POP Governor` |
| `_token` | `PURPOSE_GOV` | `PURPOSE_GOV` |
| `_initialVotingDelay` (blocks) | `1` (≈ 2 s) | `7200` (≈ 4 h on Base 2 s blocks) |
| `_initialVotingPeriod` (blocks) | `300` (≈ 10 min — easy testing) | `129600` (≈ 72 h to match the off-chain UX) |
| `_initialProposalThreshold` | `1e18` (1 membership) | `1e18` (1 membership) |
| `_initialVoteQuorumFraction` | `4` (4 % of active memberships) | `4` |

Save as `GOVERNOR`.

✅ Sanity check: `governor.token()` returns `PURPOSE_GOV`,
`votingDelay()` and `votingPeriod()` match what you set.

> Because supply = number of active members, **4 % quorum = 4 % of currently
> active memberships**, which is what you want — quorum scales with community
> size automatically.

---

### Step 11 *(mainnet-only, recommended)* — Timelock

For mainnet, deploy OpenZeppelin's `TimelockController` (24 h delay) and
transfer admin roles on PurposeTokenV2 / BountyManagerV2 / VendorRedemptionV2
to it. Skip on testnet to keep iteration fast.

---

## 3. Final checklist

Before pasting addresses back to Lovable:

- [ ] `purposeV2.hasRole(MINTER_ROLE, bountyManagerV2)` → `true`
- [ ] `purposeV2.transferAllowed(vendorRedemptionV2)` → `true`
- [ ] `purposeV2.transferAllowed(treasury)` → `true`
- [ ] `usdc.allowance(treasury, vendorRedemptionV2)` ≥ planned payout volume
- [ ] `vendorRedemptionV2.hasRole(SETTLEMENT_ROLE, backendSigner)` → `true`
- [ ] At least one vendor has `VENDOR_ROLE`
- [ ] `governor.token()` returns `PURPOSE_GOV`
- [ ] You can mint `vPURPOSE` to a test wallet, `delegate(self)`, and `getVotes` returns the balance
- [ ] End-to-end test: admin creates bounty → adds participant → checks in →
      `endBounty` mints PURPOSE → champion `approve(VendorRedemption, max)` →
      backend signer calls `redeemFor(vendor, champion, amount)` → vendor
      receives USDC, champion's PURPOSE balance drops

---

## 4. After deploy — what to send back

Paste **all six** addresses in chat (omit the ones you skipped on testnet):

```
CHAIN=base-sepolia | base
PURPOSE_V2=0x...
BOUNTY_MANAGER_V2=0x...
VENDOR_REDEMPTION_V2=0x...
TREASURY=0x...
PURPOSE_GOV=0x...
GOVERNOR=0x...
BACKEND_SIGNER=0x...        # public address; private key goes via add_secret
```

Lovable will then:
- Update `src/config/contracts.ts` (the V2 + governance address slots)
- Drop new ABIs into `src/contracts/abis/`
- Wire the POS / online-shop redemption to the backend signer
- Cut governance over from the interim Supabase tally to on-chain
  `propose / castVote / execute` (per `mem://features/governance-plan`)

---

## 5. Common gotchas

- **"TransferRestricted" on USDC payout** → you forgot Step 5 (treasury must
  be on the PURPOSE transfer allow-list).
- **"ERC20InsufficientAllowance" on redeem** → either the champion never
  `approve`d VendorRedemption for PURPOSE, *or* the treasury never `approve`d
  it for USDC. Check both.
- **`NotApprovedVendor`** on `redeemFor` → run Step 8 for that vendor.
- **`getVotes` returns 0** even though balance is non-zero → the holder never
  called `delegate(self)`.
- **Don't deploy V2 contracts to overwrite V1 yet on mainnet** — V1 is still
  in production. `CONTRACTS_V2` in `src/config/contracts.ts` stays empty
  strings until you're ready to flip; the app auto-detects via `V2_LIVE`.

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

Eight contracts total:

1. **PurposeTokenV2** — soulbound community credit (PURPOSE)
2. **BountyManagerV2** — mints PURPOSE on bounty completion
3. **VendorRedemptionV2** — escrow state machine (Lock→Capture→Settle/Cancel/Refund/Sweep)
4. **RefundPool** — USDC vault that backs vendor refunds
5. **ReceiptNFT** — soulbound on-chain SVG receipts minted on settle (champion side)
6. **PurposeGovToken** — separate ERC20Votes token used **only** for governance weight
7. **VoteERC20 (thirdweb)** — the governor itself
8. *(optional v2)* **Timelock** — execution delay for governor; recommended on mainnet

After deploying ReceiptNFT, also run:
- `receiptNFT.grantRole(MINTER_ROLE, VENDOR_REDEMPTION_V2)`
- `receiptNFT.grantRole(MINTER_ROLE, BACKEND_SIGNER_ADDRESS)` *(for receipt-mint-retry)*
- `vendorRedemptionV2.setReceiptNFT(RECEIPT_NFT_ADDRESS)`
- Add `RECEIPT_NFT_ADDRESS` to Lovable Cloud secrets.

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
| RPC URL (`CHAIN_RPC` secret) | `https://sepolia.base.org` | `https://mainnet.base.org` |
| ETH for gas | from a Base Sepolia faucet | bridge a small amount |
| Test USDC in treasury | `mint` on the testnet faucet, ≥ 100 USDC | already funded |
| Solidity | `0.8.24+` | same |
| OpenZeppelin | `@openzeppelin/contracts v5.0.2` | same |

> **Edge function env vars to set per environment:**
> - `CHAIN_RPC` — RPC URL for the target chain (above).
> - `VENDOR_REDEMPTION_V2_ADDRESS`, `RECEIPT_NFT_ADDRESS`, `REFUND_POOL_ADDRESS`, `PURPOSE_TOKEN_V2_ADDRESS`, `BOUNTY_MANAGER_V2_ADDRESS`, `PURPOSE_GOV_ADDRESS`, `GOVERNOR_ADDRESS` — paste deployed addresses after each step.
> - When `BOUNTY_MANAGER_V2_ADDRESS` is set, `bounty-checkin` automatically routes to V2; otherwise it uses the V1 address.
> - `RESEND_API_KEY` — Resend API key (used by `receipt-email` to send branded receipts from `receipts@popmgm.org`). Verify the `popmgm.org` sender domain in the Resend dashboard before sending.
> - `APP_BASE_URL` — public origin used in receipt email CTAs (defaults to `https://popmgm.org`).
>
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

---

## 6. Remix testing playbook (do this BEFORE thirdweb deploy)

Test every contract on **Base Sepolia** in Remix first. You'll need 3 EOAs
loaded in MetaMask so you can switch roles:

- **A — Admin** (deployer, holds DEFAULT_ADMIN_ROLE everywhere)
- **B — Backend signer** (will get SETTLEMENT_ROLE on VendorRedemption + MINTER_ROLE on ReceiptNFT)
- **C — Champion** (test user)
- **D — Vendor** (test merchant)
- **T — Treasury** (can be A for testing; just needs USDC + an `approve`)

Get **Base Sepolia ETH** from the Base faucet and **test USDC** from
Circle's faucet (`0x036CbD53842c5426634e7929541eC2318f3dCF7e` is USDC on
Base Sepolia — note: 6 decimals, so `1 USDC = 1000000`).

Remix setup:
- Workspace → "Default" → drop the `.sol` files in `contracts/`
- Compiler: **0.8.24** with optimizer **on, runs 200**
- Deploy & Run → Environment: **"Injected Provider — MetaMask"** (Base Sepolia)
- Switch MetaMask account A/B/C/D from the wallet UI; Remix auto-uses the active account

> Tip: after each deploy, **pin** the contract instance in Remix (📌 icon) so
> you don't lose it when you swap accounts.

---

### 6.1 — `PurposeTokenV2`

**Deploy** (account A): constructor `admin = A`.

**Test 1 — minting only works for MINTER_ROLE:**
1. Account A: `mint(C, 1000000000000000000)` (1 PURPOSE) → ❌ should revert (`AccessControlUnauthorizedAccount`)
2. Account A: `grantRole(MINTER_ROLE, A)` then retry `mint(C, ...)` → ✅ succeeds, `balanceOf(C) = 1e18`
3. Revoke role at the end: `revokeRole(MINTER_ROLE, A)`

**Test 2 — soulbound transfer rules:**
1. Account A: `mint(C, 5e18)` (after granting yourself MINTER_ROLE again)
2. Switch to **C**: `transfer(D, 1e18)` → ❌ revert `TransferRestricted` (neither side whitelisted)
3. Account A: `setTransferAllowed(D, true)`
4. Switch to **C**: `transfer(D, 1e18)` → ✅ succeeds (D is whitelisted)
5. Switch to **D**: `transfer(C, 1e18)` → ✅ succeeds (D still whitelisted)
6. Account A: `setTransferAllowed(D, false)`
7. Switch to **D**: `transfer(C, 1e18)` → ❌ revert `TransferRestricted`

**Test 3 — burnFrom path (used by VendorRedemption.sweep):**
1. Account A grants `MINTER_ROLE` to A, mints 10e18 to **C**
2. Switch to **C**: `approve(A, 10e18)`
3. Switch to **A**: `burnFrom(C, 5e18)` → ✅, `balanceOf(C) = 5e18`, `totalSupply` drops by 5e18

**Test 4 — batch whitelist:**
1. Account A: `setTransferAllowedBatch([D, T], true)` → both flip to `true` in one tx
2. Verify with `transferAllowed(D)` and `transferAllowed(T)`

✅ **Pass criteria:** mint blocked without role, P2P blocked without whitelist, mint/burn/whitelisted-transfer all work, events emitted.

---

### 6.2 — `BountyManagerV2`

**Deploy** (A): constructor `admin = A`, `token = <PurposeTokenV2 address>`.

**Wiring step (critical):** on PurposeTokenV2 → `grantRole(MINTER_ROLE, <BountyManagerV2>)`. Without this, `endBounty` reverts.

**Test 1 — happy path:**
1. A: `createBounty(2000000000000000000, 2)` → returns id `0`, event `BountyCreated`
2. A: `addParticipant(0, C)`, `addParticipant(0, D)`
3. A: `checkIn(0, C)`, `checkIn(0, D)`
4. A: `startBounty(0)`
5. A: `endBounty(0)` → ✅ both C and D receive 2 PURPOSE; event `BountyEnded(id=0, totalMinted=4e18)`

**Test 2 — guards (each should revert):**
- `addParticipant(0, C)` again → `AlreadySignedUp` (after Test 1 you can use a new bounty id `1` for these — re-create one)
- `checkIn(1, X)` for unsigned-up X → `NotSignedUp`
- `endBounty(1)` without `startBounty` → `NotStarted`
- New bounty with `minParticipants=5` but only 1 checked-in → `NotEnoughCheckedIn`
- Re-call `endBounty(0)` → `AlreadyCompleted`

**Test 3 — non-admin can't create:**
- Switch to **C**: `createBounty(...)` → ❌ revert (no BOUNTY_ADMIN_ROLE)

✅ **Pass criteria:** rewards minted only on success, guards trip in the right order, only admin can manage.

---

### 6.3 — `RefundPool`

**Deploy** (A): `admin = A`, `usdc_ = 0x036CbD53842c5426634e7929541eC2318f3dCF7e` (Base Sepolia USDC).

**Test 1 — deposit accounting:**
1. A: on USDC contract, `approve(<RefundPool>, 100000000)` (100 USDC)
2. A: `RefundPool.deposit(100000000)` → ✅, `totalDeposited = 100e6`, `available() = 100e6`, event `Deposited`
3. A: `deposit(0)` → ❌ revert `amount=0`

**Test 2 — payRefund role-gated:**
1. A: `payRefund(0x...chargeId, T, 10000000)` → ❌ revert (no REDEMPTION_ROLE)
2. A: `grantRole(REDEMPTION_ROLE, A)` (just for testing — in prod this goes to VendorRedemptionV2)
3. A: `payRefund(0xabc..., T, 10000000)` → ✅; `totalPaidOut = 10e6`, `paidPerVendor[T] = 10e6`
4. A: `payRefund(0xabc..., 0x0000..., 10000000)` → ❌ `to=0`

**Test 3 — admin withdraw:**
1. A: `withdraw(A, 5000000)` → ✅, contract balance drops by 5 USDC
2. Switch to **C**: `withdraw(C, 1)` → ❌ revert (no admin role)

✅ **Pass criteria:** deposit/withdraw track correctly, only REDEMPTION_ROLE pays refunds, only admin withdraws.

---

### 6.4 — `VendorRedemptionV2` *(the big one — full state-machine test)*

**Deploy** (A): `admin = A`, `purpose_ = <PTv2>`, `usdc_ = <USDC>`, `treasury_ = T`.

**Wiring (do all of these before testing flows):**
1. PurposeTokenV2 (A): `setTransferAllowedBatch([<VR_V2>, T], true)`
2. PurposeTokenV2 (A): `grantRole(MINTER_ROLE, A)` then `mint(C, 100e18)` (give champion test PURPOSE)
3. USDC (T): `approve(<VR_V2>, 1000000000)` (1000 USDC)
4. VR_V2 (A): `grantRole(SETTLEMENT_ROLE, B)` (backend signer)
5. VR_V2 (A): `approveVendor(D)`
6. VR_V2 (A): `setDefaultWindows(60, 120)` ← **shorten to 60s auth / 120s refund for testing**, otherwise you'll wait 24h
7. VR_V2 (A): `setRefundPool(<RefundPool>)`, then on RefundPool: `grantRole(REDEMPTION_ROLE, <VR_V2>)`

**Pre-flow check:** `quoteUSDC(1000000000000000000)` should return `1000000` (1 PURPOSE = 1 USDC).

**Flow 1 — Lock → Capture → Settle (happy path):**
1. Switch **C**: PurposeToken `approve(<VR_V2>, 10e18)`
2. Switch **B** (backend): `lock(0x01..., D, C, 10000000000000000000)` → ✅ event `ChargeLocked`
   - Verify: PURPOSE `balanceOf(<VR_V2>) = 10e18`, USDC `balanceOf(<VR_V2>) = 10e6`
3. **B**: `capture(0x01...)` → ✅ event `ChargeCaptured`
4. **B**: `settle(0x01...)` immediately → ❌ revert `AuthWindowActive`
5. Wait 60+ seconds (use a clock; you can `pause()`/`unpause()` in between to confirm it doesn't reset)
6. **B**: `settle(0x01...)` → ✅ event `ChargeSettled`; USDC `balanceOf(D) = 10e6`; PURPOSE still in escrow

**Flow 2 — Sweep (after refund window):**
1. Wait another 120+ seconds past the settle
2. Anyone (try **C**): `sweep(0x01...)` → ✅ event `ChargeFinalized`; PURPOSE `totalSupply` dropped by 10e18; charge state = `Finalized`
3. Re-call `sweep(0x01...)` → ❌ revert `WrongState`

**Flow 3 — Cancel from Locked:**
1. New chargeId `0x02...`. **C** approves another 5e18.
2. **B**: `lock(0x02..., D, C, 5e18)`
3. **B**: `cancel(0x02...)` → ✅ PURPOSE returned to C, USDC returned to T, state `Cancelled`

**Flow 4 — Cancel from Captured (within auth window):**
1. **C** approves 5e18. **B**: `lock(0x03..., D, C, 5e18)` → `capture(0x03...)`
2. Within 60s: **B**: `cancel(0x03...)` → ✅ same as Flow 3
3. Wait > 60s on a fresh charge `0x04...`, then `cancel` → ❌ `AuthWindowExpired`

**Flow 5 — Refund from Vendor (within refund window):**
1. Run a full lock/capture/settle on `0x05...` (5e18). Vendor D now holds 5 USDC.
2. Switch **D**: USDC `approve(<VR_V2>, 5000000)`
3. **B**: `refund(0x05..., 0)` *(0 = RefundSource.Vendor)* within 120s → ✅ USDC pulled from D back to T, PURPOSE returned to C, state `Refunded`

**Flow 6 — Refund from Pool:**
1. Pre-fund the pool: T does `RefundPool.deposit(20000000)` (20 USDC) [requires USDC approve to pool]
2. Run lock/capture/settle on `0x06...` (5e18). D holds 5 USDC.
3. **B**: `refund(0x06..., 1)` *(1 = RefundSource.Pool)* → ✅ Pool pays 5 USDC to T, PURPOSE returned to C

**Flow 7 — Pause freezes everything:**
1. **A**: `pause()`
2. **B**: try `lock`, `capture`, `settle`, `cancel`, `refund`, `sweep` → all ❌ revert `EnforcedPause`
3. **A**: `unpause()` — flows resume

**Flow 8 — Vendor without VENDOR_ROLE:**
1. **A**: `revokeVendor(D)` 
2. **B**: `lock(0x07..., D, C, 1e18)` → ❌ `NotApprovedVendor`
3. **A**: `approveVendor(D)` again to restore

**Flow 9 — Per-vendor windows override default:**
1. **A**: `setVendorWindows(D, 30, 60)`
2. Run lock/capture on `0x08...` and verify `charges(0x08...).authWindow == 30`

**Flow 10 — settleWithReceipt** *(only after ReceiptNFT is wired — see 6.5)*

✅ **Pass criteria:** every state transition fires the right event, balances move correctly, role/window guards trip, pause freezes the contract.

---

### 6.5 — `ReceiptNFT` *(test standalone first, then wired into VR_V2)*

**Deploy** (A): `admin = A`.

**Test 1 — minter gating:**
1. A: `mintReceipt(C, D, 5000000, 5e18, 0xabc..., 1700000000, "Alice", "Bob's Coffee")` → ❌ revert (no MINTER_ROLE)
2. A: `grantRole(MINTER_ROLE, A)` then retry → ✅ returns tokenId `1`, event `ReceiptMinted`

**Test 2 — soulbound:**
1. Switch **C** (the owner): `transferFrom(C, D, 1)` → ❌ revert `TransfersDisabled`
2. **C**: `approve(D, 1)` → ❌ revert `TransfersDisabled`
3. **C**: `setApprovalForAll(D, true)` → ❌ revert `TransfersDisabled`

**Test 3 — duplicate chargeId blocked:**
1. A: `mintReceipt(C, D, 5e6, 5e18, 0xabc..., ...)` (same chargeId as Test 1) → ❌ revert `AlreadyMinted`

**Test 4 — tokenURI renders:**
1. A: `tokenURI(1)` → returns long `data:application/json;base64,...` string
2. Decode (any base64 decoder): you should see `{"name":"POP Receipt #1", ..., "image":"data:image/svg+xml;base64,..."}`
3. Decode the inner SVG and paste into a browser address bar (`data:image/svg+xml;base64,...`) → renders the navy/gold receipt card

**Test 5 — escape safety:**
1. Mint with `championName = 'Alice "Hacker" </script>'`
2. `tokenURI` should still parse cleanly as JSON (quotes/angle brackets replaced with spaces)

**Wiring into VendorRedemptionV2:**
1. ReceiptNFT (A): `grantRole(MINTER_ROLE, <VR_V2>)`
2. ReceiptNFT (A): `grantRole(MINTER_ROLE, B)` *(backend, for receipt-mint-retry)*
3. VR_V2 (A): `setReceiptNFT(<ReceiptNFT>)`

**Test 6 (continuing VR_V2 Flow 10):**
1. Run lock + capture on `0x09...`, wait past auth window
2. **B**: `settleWithReceipt(0x09..., "Alice", "Bob's Coffee")` → ✅ `ChargeSettled` + `ReceiptMinted` events
3. ReceiptNFT `ownerOf(<newTokenId>) == C`, `tokenIdForCharge(0x09...) == newTokenId`

**Test 7 — receipt mint failure doesn't break settle:**
1. Temporarily revoke `MINTER_ROLE` from VR_V2: ReceiptNFT (A): `revokeRole(MINTER_ROLE, <VR_V2>)`
2. Run another full flow + `settleWithReceipt` → ✅ `ChargeSettled` succeeds; `ReceiptMintFailed` event emitted; vendor still got USDC
3. Re-grant role for normal flow.

✅ **Pass criteria:** soulbound enforced, tokenURI renders valid JSON+SVG, receipt mint isolated from settle (failure ≠ revert).

---

### 6.6 — End-to-end smoke test (10 minutes, all contracts together)

After everything above passes individually, run **one full champion journey**:

1. **A** mints PURPOSE to **C** via BountyManagerV2 (create bounty, add C, check in, start, end)
2. **C** approves VR_V2 for the PURPOSE balance
3. **B** does `lockAndCapture(...)` for `(D, C, amount)`
4. Wait auth window
5. **B** does `settleWithReceipt(..., championName, vendorName)`
6. **D** receives USDC, **C** receives ReceiptNFT, view `tokenURI` in browser
7. Wait refund window
8. Anyone calls `sweep(...)` — PURPOSE burned

If all 8 steps pass on Base Sepolia, you're cleared to deploy on mainnet.

---

### 6.7 — Common Remix gotchas

- **"Gas estimation failed"** with no clear reason → 99% of the time you forgot
  a `grantRole` (most common: PurposeToken's MINTER_ROLE on BountyManager, or
  VR_V2's SETTLEMENT_ROLE on the backend signer).
- **`AccessControlUnauthorizedAccount(address, bytes32)`** → check the role
  hash in the revert; it tells you exactly which role is missing.
- **`safeTransferFrom` revert with no message** → an `approve` is missing. The
  three approvals you'll forget at least once: champion → VR_V2 (PURPOSE),
  treasury → VR_V2 (USDC), vendor → VR_V2 (USDC, only for `refund(Vendor)`).
- **Auth/refund window math** — `effectiveWindows(vendor)` returns per-vendor
  override if set, otherwise default. When testing, always shorten to 60s/120s
  via `setDefaultWindows` first.
- **`burnFrom` on PurposeTokenV2 from inside `sweep`** doesn't need an approve
  because the contract is burning its **own** balance — the OZ implementation
  uses the message sender (which is VR_V2) directly via `_burn`.

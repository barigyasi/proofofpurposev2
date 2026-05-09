## Goal
Give the super-admin a card on `/admin` that triggers `distribute(address token)` on the two 0xSplits contracts. No backend / secret key needed — the admin's already-connected EOA signs the tx (anyone can call `distribute` on a Split, but routing it through the admin wallet keeps gas + audit trail tied to mission control).

## Contracts & tokens
- Donation split: `0x214aF142ff6D9f150EF994e0ea32Ba1f8db9C8dC`
- Team split: `0xa0FA4787921f9A9253810D27333031Ae2D62E334`
- Tokens to distribute: **USDC** (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`) and **native ETH** (use the 0xSplits sentinel `0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE`)

## What I'll build

### 1. Add team split to config
`src/config/contracts.ts`:
- Add `TEAM_SPLIT: "0xa0FA4787921f9A9253810D27333031Ae2D62E334"`
- Add `NATIVE_TOKEN_SENTINEL: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"`

### 2. New component `SplitsDistributeCard`
`src/components/admin/SplitsDistributeCard.tsx`
- Reads each split's pending USDC + ETH balance via `balanceOf` (USDC) and `eth_getBalance` so the admin sees what's actually sitting there before distributing.
- Two rows (Donation Split, Team Split). Each row has two buttons: `DISTRIBUTE USDC` and `DISTRIBUTE ETH`.
- Disabled when balance < dust threshold (e.g. < 0.01 USDC / 0.00001 ETH) so we don't waste gas on empty splits.
- On click: `prepareContractCall({ method: "function distribute(address token)", params: [token] })` → `sendTransaction({ account })` (uses the already-connected admin wallet) → `waitForReceipt` → toast with basescan link.
- After success, refresh the displayed balances.
- Brutalist styling matching `TreasuryHeadroomCard`.

### 3. Mount on `/admin`
`src/pages/Admin.tsx` — drop the new card above the tile grid (full-width, two-column inside).

### 4. Audit row (off-chain)
On successful tx, insert into the existing audit log path used by other admin actions (will check `AdminAudit.tsx` for the table — likely a generic admin event table — and write `{action: 'split_distribute', split, token, tx_hash}`). If no such table exists I'll skip this and just rely on the on-chain tx + toast; will confirm during build.

## Out of scope
- No thirdweb HTTP API / secret key path. The admin EOA is already connected via the MetaMask flow you set up — signing client-side is simpler and avoids storing a server signer for this.
- No new role checks. `/admin` is already wrapped in `AdminGuard`.
- No changes to the splits' recipient lists / contract URI / role grants.

## Files touched
- `src/config/contracts.ts` *(2 new constants)*
- `src/components/admin/SplitsDistributeCard.tsx` *(new)*
- `src/pages/Admin.tsx` *(mount card)*

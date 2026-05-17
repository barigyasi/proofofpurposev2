## Fix `Stack too deep` in `ReceiptNFT._renderSVG`

### Cause
One `abi.encodePacked(...)` call with ~30 arguments + 4 local color strings + the `Receipt memory r` struct fields blows past the EVM's 16-slot stack limit. Remix's default compile is without `viaIR`, so it fails at the first reference deep in the expression (`_shortAddr(r.champion)` on line 152).

### Fix: split the SVG builder into chunks
Refactor `_renderSVG` so each helper returns a small `string` and the top-level function just concatenates 3-4 chunks. No behavior change, no ABI change, no redeploy gymnastics — pure compile-time fix that also works on stock solc without `viaIR`.

Proposed structure inside `ReceiptNFT.sol`:

```text
_renderSVG(tokenId, r)
  ├─ _svgHeader(tokenId)              // <svg>, frame, "PROOF OF PURPOSE", "RECEIPT #N", divider
  ├─ _svgParties(r)                   // CHAMPION block + VENDOR block + divider
  ├─ _svgAmount(r)                    // AMOUNT label, $X.YY, "N.NN PURPOSE redeemed", divider
  └─ _svgFooter(r)                    // CHARGE, SETTLED, SOULBOUND badge, </svg>
```

Each helper:
- Takes only what it needs (e.g. `_svgParties` takes `address`, `address`, `string memory`, `string memory`).
- Declares the 3-4 color constants it uses locally, or we hoist them into `internal constant string` at contract scope to avoid repetition.
- Uses its own `abi.encodePacked` with ≤ ~10 args, well under the stack limit.

### Cleanup along the way
- Promote the four palette strings to `string constant` at contract scope so every helper reads them without re-declaring locals:
  ```solidity
  string constant SVG_BG     = "#0A1729";
  string constant SVG_FG     = "#FFFFFF";
  string constant SVG_MUTED  = "#94A3B8";
  string constant SVG_ACCENT = "#F2C033";
  ```
  (Keeping the existing navy/gold palette — brand rebrand to brutalist black + acid yellow is a separate question; ping me if you want that swap in the same edit.)

### Files touched
- `contracts/ReceiptNFT.sol` — refactor `_renderSVG` into 4 internal pure helpers; add 4 string constants. No changes to storage, events, errors, `mintReceipt`, soulbound logic, or `tokenURI` shape.

### Verification
- Recompile in Remix with default settings (no `viaIR`) — should succeed.
- `tokenURI(tokenId)` output is byte-identical to the pre-refactor version (same SVG bytes → same base64 → same JSON).
- No redeploy needed yet since the contract isn't live on the new redemption manager wiring; if it is already deployed, this requires a fresh deploy + re-granting `MINTER_ROLE` to `VendorRedemptionV2 (0x9dAf…Defe6)`.

### Optional alternative
If you'd rather not refactor, enable `viaIR: true` + optimizer in Remix's "Advanced Configurations" and the current code compiles as-is. The refactor is preferred because it keeps the contract portable across toolchains (Foundry, Hardhat default configs, BaseScan verification with stock settings).
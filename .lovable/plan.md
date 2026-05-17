## Plan

1. Refactor `ReceiptNFT.tokenURI()` so it no longer builds the full JSON payload in one large `abi.encodePacked(...)` call.
   - Extract small helpers such as metadata header/body/attributes chunks.
   - Precompute repeated formatted values once per call and pass only the minimum data each helper needs.

2. Reduce stack pressure in any remaining borderline SVG helpers.
   - If needed, split `_svgParties()` into separate champion/vendor blocks so Remix’s non-IR compiler path stays under the stack limit.
   - Keep the existing SVG output and metadata schema unchanged.

3. Verify compileability with the intended deploy settings.
   - Target Solidity `0.8.24`, optimizer enabled, runs `200`, without requiring `viaIR`.
   - Keep `viaIR` only as fallback guidance, not as the primary fix.

4. Keep deployment behavior unchanged.
   - No contract interface changes.
   - No storage layout changes.
   - If this contract is already deployed, a fresh deploy would still be required for the updated bytecode, followed by re-granting `MINTER_ROLE` to `VendorRedemptionV2` and any backend signer that mints retry receipts.

## Technical details

- The current remaining risk is the large JSON assembly in `tokenURI()`; that can still trigger `Stack too deep` in Remix/default codegen even after the first SVG refactor.
- The safest fix is structural: more, smaller pure helpers with fewer arguments and fewer inline temporary values.
- This approach is more portable than relying on `viaIR`, and it avoids forcing a specific compiler pipeline for future deploys.
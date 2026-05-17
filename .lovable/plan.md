Update `contracts/DEPLOYMENT.md` to match the new minimal ReceiptNFT design (no on-chain SVG; metadata served by the `receipt-metadata` edge function).

### Changes

1. **Line 64** — update the one-line description of ReceiptNFT in the contracts list: soulbound ERC-721 with off-chain JSON+SVG served by the `receipt-metadata` edge function.

2. **Lines 69–73** — extend the post-deploy checklist with the new step: `receiptNFT.setBaseURI("https://szlnvjzluzplpvzigboo.supabase.co/functions/v1/receipt-metadata/")`, and clarify that `RECEIPT_NFT_ADDRESS` is a Lovable Cloud secret used by the edge function.

3. **Section 6.5 (lines 538–578)** — rewrite the ReceiptNFT test plan:
   - Add a "set baseURI first" step before tokenURI tests.
   - Replace Test 4 (decode base64 data URL) with: `tokenURI(1)` returns `<baseURI>1`; fetch that URL in a browser and verify JSON renders + inline SVG paints the brutalist (near-black + acid yellow) receipt card.
   - Add a Test 4b: call `getReceipt(1)` and check tuple fields match what was minted.
   - Remove Test 5 (on-chain XML/JSON escape safety) — escaping now happens in the edge function; replace it with a note that the edge function HTML-escapes name fields, and suggest minting with `championName = 'Alice "Hacker" </script>'` and confirming the fetched JSON still parses.
   - Keep Tests 1, 2, 3, 6, 7 as-is (mint gating, soulbound, dup chargeId, end-to-end, receipt-mint-failure isolation).

4. **Line 591** — tweak the smoke-test wording from "view `tokenURI` in browser" to "fetch `tokenURI(<id>)` in browser and verify the receipt JSON + SVG render".

5. Add a short callout near section 6.5 explaining: art changes don't require redeploy — just update the edge function. To rotate the metadata host (e.g. IPFS), call `setBaseURI` again.

No other sections need changes. No code-file edits — docs only.
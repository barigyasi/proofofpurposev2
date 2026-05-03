# Fix: Champion check-in QR won't scan

## Root cause

Two compounding issues in the existing flow:

1. **Champion-side QR (`CheckInQRDialog`)** is rendered at `size={220}` with `level="M"` and a JSON payload that includes a 36-char bounty UUID + 42-char wallet (~110 chars). That produces a dense QR that's small on a phone screen and hard to focus on under event lighting. The wrapper also forces `bg-background` (dark navy) around an SVG whose default white bg is fine, but the visual contrast/framing isn't optimal.

2. **Admin scanner (`AdminBountyScan`)** uses a fixed `qrbox: 260` regardless of camera/container size, `fps: 10`, and no aspect ratio hint. On many phones the camera resolution + small qrbox = the dense QR falls below the decode threshold.

Manual check-in already works as a fallback (used during last test), so we only need to make the QR itself reliably scannable.

## Changes

### `src/components/champion/CheckInQRDialog.tsx`
- Increase `size` from 220 → 320.
- Drop EC level from `"M"` to `"L"` (payload is small; `L` = less dense modules = easier to scan).
- Set explicit `bgColor="#ffffff"` and `fgColor="#000000"` (ignore brand colors for scannables — black-on-white is non-negotiable for camera decode).
- Add `includeMargin` (quiet zone) and tighten the surrounding frame so the QR + quiet zone dominate the dialog.
- Keep wallet address shown below as text fallback.

### `src/pages/AdminBountyScan.tsx`
- Replace fixed `qrbox: 260` with a viewfinder function that sizes to ~70% of the smaller container dimension (adapts to phone vs desktop).
- Bump `fps` from 10 → 15.
- Add `aspectRatio: 1.0` and `experimentalFeatures: { useBarCodeDetectorIfSupported: true }` for better native decoding on iOS/Android Chrome.
- Add a small "manual entry" affordance: a wallet-address input + "Check in" button beside START/STOP, so admin never has to leave the scan page if a QR refuses to decode. Reuses existing `checkInParticipant(id, wallet)`.

### Vendor redeem QR (`RedeemQRDialog`)
Same scannability fix while we're here, since user will hit it next when testing the vendor flow:
- Bump `size` 240 → 320, set explicit black-on-white, drop to `level="L"`, add quiet zone.
- (Keep gold styling on surrounding chrome, just not on the QR itself.)

## Out of scope
- Soulbound PURPOSE token redeploy — user will handle separately at contract-redeploy time.
- No DB / edge function / contract changes needed.
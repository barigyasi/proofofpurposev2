## Goal

On mobile only, make the PurposeCard inner panels more see-through and the colored halo softer/more diffuse. Desktop (`sm:` and up) stays pixel-identical to today.

## File

`src/components/champion/PurposeCard.tsx`

## Changes

### 1. Halo layer (line 208)
Stronger blur + full opacity on mobile, original values on desktop.

- From: `blur-2xl opacity-90`
- To: `blur-3xl opacity-100 sm:blur-2xl sm:opacity-90`

### 2. Inner panels — all three variants (`innerPanel` in `variantStyles`)
Lower the panel fill on mobile so the card's gradient/halo shows through more; desktop unchanged.

- **obsidian** (line 44):
  `bg-white/55 dark:bg-black/10` → `bg-white/35 sm:bg-white/55 dark:bg-black/5 dark:sm:bg-black/10`
- **aurora** (line 61):
  `bg-white/55 dark:bg-black/10` → `bg-white/35 sm:bg-white/55 dark:bg-black/5 dark:sm:bg-black/10`
- **signal** (line 78):
  `bg-black/5 dark:bg-black/10` → `bg-black/[0.03] sm:bg-black/5 dark:bg-black/5 dark:sm:bg-black/10`

### 3. Backdrop blur on panels (lines 239 and 245)
Make the frost stronger on mobile so the translucent panels still feel glassy, not muddy.

- From: `backdrop-blur-md`
- To: `backdrop-blur-xl sm:backdrop-blur-md`

(Applied to both the logo chip and the cardholder/wallet panel.)

## Why this is safe for desktop

Every change uses a base value + `sm:` override that restores the current value at the `sm` breakpoint (≥640px). Nothing else (typography, spacing, shadows, gradients, tilt/glare) is touched.

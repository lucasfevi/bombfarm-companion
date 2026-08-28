# Level / stars sheet sync

**Status:** hard truth  
**Sources:** the hero-planner-absorption decision; feature `level-stars-auto-stats`

Changing **level** or **stars** must keep naked, geared, and derived combat consistent without forcing a save reimport.

## Locked strategy

### Birth-backed heroes (`birth` present)

Recompose from birth — do **not** residual-rescale:

1. `naked = nakedFromBirth(birth, toLevel|toStars, sheetOther)`
2. `gearedOverride = composeSheetFromBirth({ …, pts: zero })` (tree-inclusive, zero points)
3. Use `sheetsFromBirth` from one code path for level/stars steppers **and** loadout sync

Residual rescale understates multiplicative tree terms (e.g. `dmg_static`) on the catalog Δ,
so Points After / DPS would drift from Stats Total after a level-up.

### Legacy / no-birth heroes

When level or stars change from `from` → `to`:

1. Update naked with `rescaleNakedForLevel` / `rescaleNakedForStars` (attack-only for level; stars scale Attack, Energy, Crit %, Crit Dmg, Penetration, CDR, Luck — Speed exempt).
2. `oldCatalog = applyGear(oldNaked, loadout, sheetOther)`
3. `residual[stat] = gearedOverride[stat] - oldCatalog[stat]` (per sheet stat)
4. `newCatalog = applyGear(newNaked, loadout, sheetOther)`
5. `gearedOverride = newCatalog + residual` (stat-wise, full precision — no rounding)

Use the shared helpers `rescaleHeroForLevel` / `rescaleHeroForStars` (or equivalent) from one code path for steppers and +1 CTAs.

## Star mult (capture-backed)

`starsMult = 1 + STAR_MULT_PER_STAR × ★` (0..`MAX_STARS`), i.e. `1 + 0.25 × ★` over 0..3 today — ×1.75 at max stars. Applies to intrinsic Attack, Energy, Crit %, Crit Dmg, Penetration, CDR before items. **Speed does not scale** (Bram geared + Orin unequipped, 2026-07-23). Luck scales with ★ and is on the planner sheet model (carrying a luck key across SheetStats/SheetKey/PointAlloc and the stored HeroRecord, AD-BSP-19); it is not displayed until Wave 6.

The per-★ share is the wiki's `gemas.mult_por_estrela` and it **moves between patches** — it was `0.5` (×2.5 at max stars) until a patch halved it. The 2026-07-23 capture above measured the SCOPE (which stats scale, and that Speed does not), and that has held across the change; only the magnitude moved. Read the magnitude from `STAR_MULT_PER_STAR` in `packages/domain/src/gear/catalog.ts`, never from a number written into prose — including this paragraph.

## Hard constraints

1. **`sheetOther` is mandatory** on both `applyGear` calls (on-sheet ability contributions such as Ponta / Olho). Dropping it is a fail — tests should spy/arg-assert call sites when output equality cannot discriminate (LVL-06 lesson).
2. **Never ratio-scale geared attack** by the level power multiplier. Weapon damage is flat on top of naked; gearedΔ attack must equal nakedΔ attack exactly when only level changes and loadout has flat weapon damage.
3. **No silent wipe** of geared to pure `applyGear(newNaked, …)` without residual, unless the user explicitly approves a product change.
4. Ability-point trim/caps on level change keep existing planner behavior unless a separate bug is filed.
5. Manual geared edits win until the next level/stars change (which re-runs residual + re-apply).

## Wave 4 — naked is tree-free (DEC-03)

`naked` (the Locked strategy above) is **Hero + Ability, tree-free** after Wave 4 —
`nakedFromBirth` never bakes the account skill tree in; a separate stage
(`applySkillTree`) applies it exactly once, on top, to produce the displayed sheet
(`AD-BSP-12`). The pooled per-point bases this file's rescale helpers read
from stay today's (`GAP-W2-01`-era) contaminated values until Wave 5 rewires import to
call `nakedFromBirth` directly — this doc's rescale strategy is unaffected either way,
since `rescaleNakedForLevel` / `rescaleNakedForStars` only ever touch `naked` as an
opaque `SheetStats`, never re-deriving it from birth rolls.

`rescaleNakedCrit(naked, rarity, otherCrit, stars)` — the rarity-midpoint reset used by
`use-hero-build-actions.ts` when a sheet ability's `other` term changes — is
**`@deprecated`**. It resets naked crit % to `BASE_ROLLS[rarity]`, discarding
the hero's own birth roll; a well-rolled hero (Bellatrix's crit chance 9.51 vs Raro's
rarity midpoint 7, a 36% error) gets silently corrupted. `rescaleNakedCritChance(naked,
oldOtherPct, newOtherPct)` replaces it with the same ratio form `rescaleNakedPen` /
`rescaleNakedCritDmg` already use, preserving the hero's own roll. Not swapped at the
two call sites (`use-hero-build-actions.ts:74`, `:110`) in this wave — that hook has no
test harness in this repo (Wave 2 `M7`), so the swap is Wave 6's, where `prevMods` is
already in scope at both sites.

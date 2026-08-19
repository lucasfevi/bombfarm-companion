---
"@bombfarm/domain": minor
"@bombfarm/web": minor
---

Reverts crit chance and cooldown reduction back to percent-of-base, undoing the flat-addend model
`crit-damage-is-flat.md`/`game-update-20260815-catalog.md` shipped three days earlier. The
2026-08-15 patch moved both stats to flat addends; the 2026-08-18 patch put them straight back:

```
before (08-15..08-18): sheet.critChance = birth.critChance +  Σ gear + Σ ability + tree
after  (08-18 onward):  sheet.critChance = birth.critChance × (1 + Σ gear + Σ ability + tree)
```

Crit **damage** did not move either time — it stays the flat model from the 2026-08-13 patch,
untouched by this change.

**Measured on two 2026-08-19 captures** (account 486): a 12-hero export and, 2 hours later, the
same roster after a deliberate 10-point respec on one naked hero. That respec is the anchor —
`n_crit × 0.02 = 0.1`, `n_cdr × 0.02 = 0.1`, `n_crit + n_cdr = 10` — which the capture alone can't
fully disambiguate (any integer split from (1,9) to (9,1) fits), so the wiki table's independently
published `r_crit = r_cdr = 0.02` breaks the tie; the respec then confirms both rates exactly, with
no base-roll or level term left over. `POINT_GAIN.critChancePctOfBase` round-trips to its old
pre-08-15 value (0.02) exactly; `POINT_GAIN.cdrPctOfBase` does **not** — it lands at 0.02, half its
old pre-08-15 value of 0.1, not a full round-trip. Worth flagging plainly since crit chance's rate
did round-trip and the asymmetry reads like a typo otherwise.

**Item catalog**: `statBase.crit` and `statBase.cooldown` (and every def's rolled `crit`/
`cooldown` value) are rescaled ×40/7, from `0.00112704`/`0.00098361` to `0.00644023`/`0.00936771`
— the exact inverse of the 08-15 patch's rescale in the other direction. Every other `statBase`
value, every set/def structure, the level ladder, and the 2026-08-16 stat redistribution are
untouched; this is a value-only rescale of two stats across the existing structure.

**Abilities**: `olho_clinico` (Olho Clínico) is `+4.285714285714286%` crit chance per rank, `% of
base` — measured directly, rank-20 residual 0 against the exact `6/7` fraction. `pressagio_mortal`
(Presságio Mortal) is `+5.714285714285714%` TEAM crit chance per rank — the same ×40/7 rescale
applied to its own pre-08-15 value, but **published, not measured**: no capture, before or after
either patch, has ever included a hero who owns this ability, so nothing confirms it directly. Two
unrelated crit-chance sources (an on-sheet ability and the item base) landing on the identical
rescale factor is what makes the published value credible, not a cross-kind guess by itself.

**`reoptBudget` now clamps to hero level unconditionally** (`packages/domain/src/points-reopt-core.ts`).
It previously floored at `level - pts.luck` without an upper clamp, so a bad upstream `pts` vector
(from `inferSpentPoints` or elsewhere) could hand the respec search several times a hero's real
budget: on a level-69 hero the unclamped floor produced a 210-point budget, and the advisor sold a
+18.9% gold/hr respec for 429,000 gold with 0% of that gain achievable — 101% phantom. Clamping
removes the amplifier; `tests/points-within-level-budget.test.ts` remains the guard that should go
red first if a `pts` vector ever overshoots `level` upstream. This narrows the farm-respec advisor's
proposed gains across the board, independent of the crit/CDR shape change above.

**What moves in the planner**: any hero with crit-chance or cooldown gear, ability ranks, tree
points, or spent stat points gets a different sheet value under the restored pooled formula, and
every derived figure downstream (crit factor, DPS, farm-rate estimates, next-point rankings) shifts
with it. The account-486/phase-26 farm-rate anchor moves from 365,087 to 364,417 gold/hour
(clear time 105.62s → 105.81s) — expected, since it is downstream of `critFactor`.

**Local data migration.** A hero saved between 2026-08-15 and 2026-08-18 has its
`naked.critChance` baked under the flat model; read directly under the restored pooled model it
would show the wrong Birth roll. A new one-shot migration
(`bf-hp-critcdr-repool-migrated-v1`) converts each affected hero's stored value back to a
percent-of-base roll the first time the planner loads after this update, mirroring the existing
crit-damage and crit-chance migrations. It also drops any stale `gearedOverride` the same way those
migrations do. Runs automatically; nothing to do.

**Fixture corpus**: adds two 2026-08-19 captures (a 12-hero export and its 10-point respec) as the
new sheet-math anchor and the point-rate witness for both rates. `save-20260816-5heroes-gear-cdr-crit.json`,
`save-20260816-9heroes-redistrib.json`, and `save-20260817-11heroes.json` are retired from the
level-budget invariant as non-subjects — they capture the three-day flat-addend window and no
current model reproduces both them and the post-08-18 game. `flat-crit-cdr-shape.test.ts` is
inverted from a flat-shape sensor into a percent-of-base shape sensor over the new captures.

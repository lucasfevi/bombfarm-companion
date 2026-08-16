---
"@bombfarm/domain": minor
"@bombfarm/web": minor
---

Re-synced the planner against the 2026-08-15 game patch: new item catalog, a raised hero level
ceiling, and — the load-bearing part — crit chance and cooldown reduction moving from
multiplicative shares of the hero's roll to flat addends.

**Crit chance and CDR are FLAT now.** Gear, sheet abilities, the skill tree and stat points all
ADD to the birth roll instead of multiplying it:

```
before:  sheet.critChance = birth.critChance × (1 + Σ gear + Σ ability + tree)
after:   sheet.critChance = birth.critChance +  Σ gear + Σ ability + tree
```

Measured on four post-patch save exports (account 486, 2026-08-16), residual 0 to floating point
on every hero-instance, every point budget landing exactly on the hero's level. Each term is
isolated by at least one hero: a hero with no items and no crit ability pins the tree term alone;
two more add `olho_clinico` 20 on top; a deliberate respec of a naked L4 hero pins the per-point
rates (`crit_chance` +0.00048788 on 2 points, residual 3.0e-18; `cooldown_reduction` +0.0007026,
residual −1.1e-19) with no base-roll and no level scaling. Penetration, speed, luck and crit
damage did **not** change shape.

**The ITEM half is measured too**, on `save-20260816-5heroes-gear-cdr-crit.json`, and it is what
rules out the tempting reading that a ~55x rescale of the wiki's crit and cooldown values was a
rescale only. Every hero there wears gear rolling `crit` and/or `cooldown`, and every hero's
`cooldown_reduction` delta is the plain SUM of its items' rolls to ≤3e-18, with no base-roll
factor anywhere. The discriminator is model-free: any percent-of-base model has the form
`Δ = birthRoll × f(gear, ability, tree)`, so two heroes with identical gear and ability must show
deltas in the ratio of their rolls. Bellatrix and Jon (rolls 74% apart) and Minato and Doran
(55% apart) each move by *identical* amounts. No percent-of-base model of any coefficient fits.
`packages/domain/tests/flat-crit-cdr-shape.test.ts` pins that argument, and goes red under a
mutation of the shipped conversion.

Consequences: `POINT_GAIN.critChancePctOfBase`/`cdrPctOfBase` become `critChanceFlat` (0.024394)
and `cdrFlat` (0.03513); `GearBonuses.critPct`/`cdrPct` become `critFlatPct`/`cdrFlatPct` in
planner percentage points; `SheetOtherPct.critChance`/`cdr` become `critChanceFlat`/`cdrFlat`
alongside the existing `critDmgFlat`. `olho_clinico` is +0.04574 pp/rank and `pressagio_mortal`
+0.06099 pp/rank. Both the crit-chance and cooldown reads in the planner's UI follow the new
units: the gear-bonus table stops rescaling the two flat columns by 100 (a nv300 crit roll read
"+744.0%" instead of "+7.4"), and the Presságio Mortal team-buff field is relabelled from
"Crit % base" with a step of 1 to "Crit pp" with a step of 0.05, its full 20-rank range now being
~1.22. The Points-tab help text in both locales now describes crit chance and CDR as flat, which
is the model actually shipped.

A one-shot local-storage migration (`bf-hp-critchance-flat-migrated-v1`) replays existing rosters,
mirroring the crit-damage one. It fires on **two** triggers, not one: an `olho_clinico` rank (the
sheet-ability bake) *or* a loadout carrying a crit or cooldown roll (the gear term, which changed
shape for both stats and which cooldown — having no ability at all — is only reachable through).
Gating on the ability alone would leave every rank-0 hero wearing cooldown gear stale forever, and
cooldown leads the pants slot after the 2026-08-16 redistribution.

**Items:** levels now run 10…300 in steps of 10 with exactly one set per level (30 sets, 240
definitions), including three new top-end sets — Obsidiana (nv280), Magma (nv290), Vazio (nv300).
Every set above nv90 was re-keyed to a new native level by the game. Catalog v4's
percentage-of-Attack Dano regime is **gone**: `DMG_PCT_MIN_LEVEL` and `isDmgPctLevel` are removed
and `scaledValores` returns flat Dano at every level. `composeAttack`/`decomposeAttack` keep their
signatures and stay exact inverses.

**Hero level ceiling:** new `HERO_MAX_LEVEL` (500) exported from `@bombfarm/domain/model`, used by
`canLevelUp`, `nextLevelStep` and the planner's level clamps. `levelPowerMult` is unchanged — the
game's own curve still reports `1 + 0.04 × (level − 1)` at level 500.

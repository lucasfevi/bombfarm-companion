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

Measured on two post-patch save exports (account 486, 2026-08-16), residual 0 to floating point
on all 16 hero-instances, every point budget landing exactly on the hero's level. Each term is
isolated by at least one hero: a hero with no items and no crit ability pins the tree term alone;
two more add `olho_clinico` 20 on top; a deliberate respec of a naked L4 hero pins the per-point
rates (`crit_chance` +0.00048788 on 2 points, residual 3.0e-18; `cooldown_reduction` +0.0007026,
residual −1.1e-19) with no base-roll and no level scaling. Penetration, speed, luck and crit
damage did **not** change shape.

Consequences: `POINT_GAIN.critChancePctOfBase`/`cdrPctOfBase` become `critChanceFlat` (0.024394)
and `cdrFlat` (0.03513); `GearBonuses.critPct`/`cdrPct` become `critFlatPct`/`cdrFlatPct` in
planner percentage points; `SheetOtherPct.critChance`/`cdr` become `critChanceFlat`/`cdrFlat`
alongside the existing `critDmgFlat`. `olho_clinico` is +0.04574 pp/rank and `pressagio_mortal`
+0.06099 pp/rank. A one-shot local-storage migration
(`bf-hp-critchance-flat-migrated-v1`) replays existing rosters, mirroring the crit-damage one.

**Items:** levels now run 10…300 in steps of 10 with exactly one set per level (30 sets, 240
definitions), including three new top-end sets — Obsidiana (nv280), Magma (nv290), Vazio (nv300).
Every set above nv90 was re-keyed to a new native level by the game. Catalog v4's
percentage-of-Attack Dano regime is **gone**: `DMG_PCT_MIN_LEVEL` and `isDmgPctLevel` are removed
and `scaledValores` returns flat Dano at every level. `composeAttack`/`decomposeAttack` keep their
signatures and stay exact inverses.

**Hero level ceiling:** new `HERO_MAX_LEVEL` (500) exported from `@bombfarm/domain/model`, used by
`canLevelUp`, `nextLevelStep` and the planner's level clamps. `levelPowerMult` is unchanged — the
game's own curve still reports `1 + 0.04 × (level − 1)` at level 500.

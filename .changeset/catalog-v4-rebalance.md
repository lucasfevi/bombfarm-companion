---
"@bombfarm/domain": minor
"@bombfarm/web": minor
---

Refresh the item catalog to the game's v4 balance patch and teach the gear math the new
two-regime Dano.

`packages/domain/src/data/catalog.json` is regenerated from the wiki's live payload. Every stat
base is exactly ×0.7 of the previous values (Dano 27.5 → 19.25, Energia 0.05 → 0.035, Velocidade
0.0011 → 0.00077, Sorte 0.044 → 0.0308, Crítico 0.088 → 0.0616, Penetração 0.2 → 0.14, Cooldown
0.266667 → 0.1866669). The catalog's shape is unchanged — same 216 definitions, ids, slots, native
levels, per-def stat orderings, levels 10–90 and rarities 0–5. No new sets, slots, tiers or rarities.

Dano now has two regimes. Below item level 50 it stays a flat number on the `nivelMult` ladder; at
level 50 and above it becomes a fraction of the hero's Attack — 10/15/20/25/30% at nv 50/60/70/80/90.
The catalog carries this as `dmgPctMinLevel` plus a `dmgPct` ladder, `scaledValores` resolves the
regime from the *item's* level (a definition can be scaled across the boundary) and tags each roll
`unit: 'flat' | 'pct'`, and `GearBonuses` gained a `dmgPct` field alongside `dmgFlat`. The planner's
per-slot stat grid and the Totals table render the new percent rolls as percentages, with a new
"Dano (% da Ataque)" / "Damage (% of Attack)" row.

The wiki documents the regime but not which Attack the percentage multiplies. We assume it applies
to the naked attack, with flat gear Dano and spent attack points added outside the product, matching
how every other percent stat is already pooled. That assumption is isolated in `composeAttack` /
`decomposeAttack` in `gear/catalog.ts`; every call site routes through them.

Also fixes `inferSpentPoints` returning `-0` for a point count when the solved value rounds to
negative zero, which leaked into stored hero records.

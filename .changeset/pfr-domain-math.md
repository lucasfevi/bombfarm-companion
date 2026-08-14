---
"@bombfarm/domain": minor
---

Adds the farm-rate estimation module for Phase Farm Ranking (`@bombfarm/domain/farm-rate`):
`computeHeroFarmFacts`, `computeSquadFarmFacts`, `computeFarmRateRow`, `computeFarmRateTable`,
`computeFarmRates`, `returnBonusMultiplier`, plus the `E_D_CELLS` / `FORTUNA_AURA_CAP` constants
and the `HeroFarmFacts` / `SquadFarmFacts` / `FarmRateRow` / `FarmRateOptions` / `FarmFactsInput` /
`ReturnBonusMode` types. Turns a roster and account into expected gold/hr, chests/hr, keys/hr
(signed), gems/hr, time-pieces/hr, XP/hr, clear time and jaula facts for all 600 wiki phases —
zero advisor-pipeline calls per phase, one call per enabled hero.

`GRID_SPEED_COEF` and `EFF_IA` are promoted from module-private to exported on
`@bombfarm/domain/model`.

`account.max_phase` is now parsed on import (`account.max_phase` primary, `skills.max_phase`
fallback, normalized to an integer in `[1, 600]` or `null`), surfaced as
`AccountImportData.maxPhase` (required) and mirrored as an optional `AccountShared.maxPhase`.

Corrects two stale ability effect texts that mismatched the live wiki API: `veia_ouro` reads
`+2%/level (self), +40% at cap` (was `+4%/level`), and `fortuna` reads `+0.5%/level (team aura),
+10% at cap` (was `+2%/level, +40% at cap`) — in both `model/abilities.ts` and `game-labels.ts`,
English and Portuguese. Both keep `effect: { kind: 'none' }`; no combat modifier changes.

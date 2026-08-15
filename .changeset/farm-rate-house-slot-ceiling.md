---
"@bombfarm/domain": minor
"@bombfarm/web": minor
---

Fixes three defects in the farm-rate throughput model. Against live telemetry on account 486 at
phase 26 the estimator predicted 571,546 gold/hr where 371,263 was banked; it now predicts
498,898 (−12.7%). Gold-per-prop was already correct (214.2 predicted, 216.6 observed) — the whole
error was throughput. A residual ~1.34x remains and is deliberately left open: it belongs to the
bomb-cadence term, which is held for a pending live capture. No cadence constant was touched.

**The House recovery-slot ceiling is now modelled.** Every hero's `uptime` is its own duty cycle
`F/(F+T)`, and the previous model simply summed those — which assumes the House recovers every
hero in parallel. It does not: it refills `casa.slots` heroes at a time and the rest queue at
frozen energy. Each hero occupies a recovery slot for `1 − uptime` of wall clock, so a roster's
demand is `Σ (1 − uptime)`; account 486's 7 heroes ask for 5.31 slots against the 3 they own. The
scarce slot-seconds are now allocated greedily by value density (props delivered per deployment),
each hero capped at its own duty cycle — the strongest hero takes a slot ahead of a weaker one,
as the real client does. That puts 1.3153 heroes on the field against a live-measured 1.317;
uniform throttling would have said 1.03. The allocation is per-phase, because mitigation changes
the ranking, and adds zero advisor-pipeline calls.

**Rest seconds now come from the save.** `casa.cycle_secs` is parsed onto the account and
preferred wherever rest time is needed; the `HOUSES` table (a whole-minute reconstruction, ~7.8%
fast — 1077s against a measured 1168.42s at Casa I level 11) is now only the fallback for payloads
that do not carry the key. This feeds `Context.restSeconds`, so it moves duty-cycle and sustained
DPS numbers on the advisor and the team plan too, not only the farm board.

**Field slots and House slots are no longer the same number.** `casa.slots` is the House's
RECOVERY concurrency; the field concurrency cap is `skills.field_slots` (3 vs 6 on account 486).
The farm board read the former as the latter, capping a 6-wide field at 3. Both are now parsed and
carried separately, and the field cap is applied after the House ceiling rather than to the
unconstrained uptime sum.

API: `SquadFarmFacts` gains `houseSlots` and `houseSlotDemand` and loses `concurrencyScale`, which
moves to `FarmRateRow` (now `min(1, fieldSlots / heroesOnField)`) alongside a new `heroesOnField`.
`AccountImportData`, `AccountShared` and the web planner store gain `fieldSlots` and
`houseCycleSecs`; `AdvisorPipelineInput` gains an optional `houseCycleSecs` and the team-plan farm
context an optional `cycleSecs`. `resolveFieldSlots` (`@bombfarm/domain/casa-slots`) and
`resolveHouseRestSeconds` (`@bombfarm/domain/model`) are new exports.

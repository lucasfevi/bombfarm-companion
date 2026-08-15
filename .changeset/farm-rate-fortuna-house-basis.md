---
"@bombfarm/domain": patch
---

Fixes a second place the farm-rate estimator modelled unlimited-parallel House recovery: the
Fortuna aura (`fortunaAura`) summed every hero's own unconstrained duty cycle, so a roster
throttled by the House recovery-slot ceiling still got full credit toward the aura for heroes the
House could not actually keep on the field. On a roster overcommitting the House by 1.7x, this
overcounted `fortunaAura` — and the `goldPerHour` it multiplies — by the same ratio.

`fortunaAura` now sums `uptime_h × activity_h` (the House-allocated on-field fraction), the same
basis `heroesOnField` already uses. Because that allocation is phase-dependent (it is ranked by
props-per-deployment, which depends on the phase's mitigation), `fortunaAura` moves from
`SquadFarmFacts` to `FarmRateRow`, following `concurrencyScale`'s precedent from the House-ceiling
fix. `sorteFraction` stays on the unconstrained, phase-independent basis: it is a normalized
average rather than an unnormalized sum, so the same overcommit does not inflate it, and
reweighting it would have no fixed direction absent a roster where combat value-density and Sorte
investment are correlated.

API: `SquadFarmFacts` loses `fortunaAura`; `FarmRateRow` gains it.

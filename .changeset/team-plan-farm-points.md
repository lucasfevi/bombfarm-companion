---
"@bombfarm/domain": minor
---

Make the Team Plan's stat-point pass optimize for gold per hour when the plan's objective is farm.

The farm objective landed first, but only the gear moves answered to it. The point pass still ran
the damage optimizer in both modes, and farm mode merely accepted or rejected whatever it proposed.
On the newest committed account that left the plan proposing no point changes at all: the damage
pass found nothing the farm objective would take.

The pass now runs the same joint search the Farm page's respec advisor runs, over the same bases,
scoped to the heroes the plan may move. One solve rather than a per-hero loop, because gold per
hour is a rate the whole rotation produces — House allocation, field luck and the phase argmax are
all nonlinear in who is present, so one hero's points change what every other hero's points are
worth, and a per-hero loop would pay a phase sweep each to answer a question none of them sees
whole. Heroes the search may not re-spend still count toward the rate; they simply get no budget.

Measured on the two captures at or past the 2026-08-28 damage boundary, against the same plan's
gear alone: **+11.51% gold per hour where the plan previously found nothing, and +2.84% on the
smaller account**. On two older captures, whose absolute figures the sheet-math regime gate no
longer vouches for, the same comparison moves +23.43% to +34.57% and +14.50% to +24.47%.

Farm mode costs more time for it — 2.4x to 7.8x a damage-mode plan on the same account, 19 s at
the worst measured, against a 250,000-evaluation ceiling nothing came close to reaching. The
default objective is still damage, and damage-mode plans are byte-identical.

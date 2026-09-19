---
"@bombfarm/domain": patch
---

Stat-point advice for gold per hour is built from zero, not from the build you have.

**The Optimizer's Point reset and the Farm page's respec advisor no longer echo your current
allocation.** A hero that had every point in crit damage was told to keep most of it in crit
damage; the same hero with every point in attack was told to keep attack. The search started
its descent from the build the player had, and on an objective that only moves at whole
head-to-kill steps it stayed there. Both surfaces now build the proposal from zero — the hero's
own birth stats and a sustained-damage greedy walk decide where its points go — and the build you
have re-enters only at the end, as the bar the proposal must clear. Two rosters that differ only
in how their points sit today are offered the same build.

**And the search itself finds more.** Gold per hour only moves at whole head-to-kill steps, and
crossing one often takes more than the ten points a move could shift before, so the descent
settled in whichever basin it started from. Moves now go up to the whole of a stat, and each
probe is priced at the winner's own phase before the full phase sweep is paid for, so the same
budget buys several times the search. Measured on four captures at the shipped budget: +1.4%,
+0.7%, +0.3% and ±0 gold per hour against the old search, in less time on every one.

**A tie keeps your build.** When the from-zero proposal is no better than what you have, the
advice is to change nothing, exactly as before; a reset is never recommended for a gain of zero.
Banked points are the one exception: a hero with unspent points is offered them even when
spending them does not move gold per hour, since placing them costs nothing.

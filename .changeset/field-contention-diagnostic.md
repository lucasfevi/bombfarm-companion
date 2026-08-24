---
"@bombfarm/domain": patch
"@bombfarm/web": patch
---

Report how often the Farm board's field slots are the bottleneck.

`FarmRateRow` gains `fieldContentionPct` — the share of wall clock spent with a rested hero benched because every field slot is taken. On a 14-hero roster at 9 field slots that is 26% of the time, which the board previously had no way to say: `concurrencyScale` compares mean occupancy against the cap, and a mean of 8.08 against 9 slots reads as "the cap never binds".

The Farm board surfaces it above the rotation pool when it exceeds 5%, naming more field slots as the direct fix and stating plainly that the gold/hr estimate does not model the wait. It does not suggest that benching heroes helps, because measurement says it does not: dropping the five weakest from a 14-hero pool takes contention to 0% and gold/hr from 19.97M to 17.17M.

`concurrencyScale` itself is unchanged, deliberately. Correcting it requires knowing which hero takes a freed slot, and the game fixes no such rule. Across seven roster/slot regimes measured against a 240-hour simulation with uniformly-random deployment, the existing expression is within 6.7% and no simple closed form tested beat it. The frequency needs no such assumption — uniformly-random and strongest-first deployment differ by up to 24% in throughput but under 3 points in contention — which is why it is reportable when a corrected magnitude is not.

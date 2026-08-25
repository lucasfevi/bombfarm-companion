---
"@bombfarm/domain": patch
"@bombfarm/web": patch
---

Charge the field queue for the heroes it makes wait.

Heroes join the field FIFO, by who finished resting first. `concurrencyScale` compared the MEAN demand against the cap — `min(1, fieldSlots / heroesOnField)` — which charges nothing whenever the average fits, however often the peaks do not. Since `min` is concave, that form can only ever run optimistic.

FIFO is identity-blind: the queue does not read a hero's power, so the loss needs no assumption about who takes a freed slot, which is the reason this factor was left approximate until now. The scale is the served share of demand, `E[min(fieldSlots, X)] / E[X]`, over the same Poisson-binomial the contention diagnostic already solves.

Worth 6–7% on a roster whose field is contended, and EXACTLY zero where the field cannot fill. Against nine hours of telemetry on a 9-slot account the board's error falls from +21.2% to +9.5%; on an account whose field never fills, every number is byte-identical. It does not close the remaining throughput gap — that is cadence, tracked in `docs/farm-cadence-density.md` — but it is the part with a known mechanism behind it.

Marginal stat values move accordingly: a point of Energy buys uptime, and uptime is what the queue rations, so Energy is worth slightly less at the margin once the field saturates. Attack, Speed and CDR are untouched to the digit.

Also fixes a latent budget escape the change surfaced: the Respec Advisor could propose a build spending more points than the hero owns. Five of the six search seeds build from the budget, but the `'current'` seed passed the hero's own vector through unclamped, and every local-search move is a transfer — so an over-spent hero carried its excess into the recommendation. It went unnoticed because a budget-built seed happened to win; re-scoring the candidates moved the winner and it surfaced. Now clamped at the seed, guarded by a test that forces the current seed to win rather than hoping it does.

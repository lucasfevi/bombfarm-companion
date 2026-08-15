---
"@bombfarm/domain": minor
---

Adds a farm-objective optimizer to `@bombfarm/domain`: `solveFarmRespec` and `gateFarmRespec`
(`@bombfarm/domain/farm-optimize`), the objective layer `@bombfarm/domain/farm-optimize-objective`,
and a per-hero farm basis seam added to `@bombfarm/domain/farm-rate`.

Given a roster, an account and an objective (gold/hr, chests/hr, or a weighted blend of both),
the solver jointly picks a per-hero stat-point allocation and the phase to farm it at, coupling
the two because the best build depends on which phase it is evaluated against and vice versa.
It reports the proposed allocation for every enabled hero, the recommended phase, the gain over
the player's current build, the in-game respec cost and the payback time in gold-earning hours.

Two evaluation tiers ship, both with bounded, named, exported evaluation budgets so neither can
run unbounded: a cheap always-on gate that reports a conservative lower bound on the available
gain, and a fuller on-demand solve that also reports a cost frontier (the best single-hero and
best two-hero respec, each re-solved on its own, not truncated from the joint answer) and a
plateau report — the range of near-optimal energy allocations around the recommendation, since
the true optimum is a broad flat region rather than a single sharp point.

The solver never re-enters the advisor pipeline beyond the one call per enabled hero the estimator
already makes: every candidate build's facts are reconstructed by pure scalar math from that one
call, which is what keeps hundreds of candidate evaluations cheap. It is deterministic — two
solves on equivalent inputs always agree, including on the plateau region and independent of
hero-array ordering — and re-running it on its own recommendation is a fixed point: it reports
nothing further to gain. Stat-point luck is never touched.

Also extracts the per-level in-game stat-point respec cost (`1000 gold × level`) into one shared
helper, `respecCostGold` (`@bombfarm/domain/respec-cost`), and switches the Team Plan waterfall's
existing inline copy of that same rule over to it, with no change in the value it has always
produced.

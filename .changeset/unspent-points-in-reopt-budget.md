---
"@bombfarm/domain": minor
"@bombfarm/web": minor
---

The point optimiser (`findGateCandidate` Tier 1 and `optimizeBuild` Tier 2, `points-reopt.ts`) now folds a hero's banked, unspent stat points (`stat_points_available` from the save) into its search budget instead of only reallocating already-spent points. A hero with 0 spent and N unspent points previously tripped the `budget <= 0` fast path and got no recommendation at all — the search now runs and can place those points, in both the automatic reset gate and the Points tab's on-demand "Optimize build".

`HeroRecord` now persists `statPointsAvailable` (additive, defaults to 0 for existing records — no behaviour change on upgrade). `ReoptInput.statPointsAvailable` is optional and defaults to 0, so callers that don't have a per-hero banked count wired through yet (the Team Plan solver's points passes) keep today's exact behaviour.

The Points tab surfaces the banked count next to the spent/level counter (`+{count} unspent`) so a hero the optimiser now touches despite an unchanged spent total reads as banked points being spent, not as a bug.

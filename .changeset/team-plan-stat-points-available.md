---
"@bombfarm/domain": minor
"@bombfarm/web": minor
---

The Team Plan roster gear optimizer now honours a hero's banked, unspent stat points
(`HeroRecord.statPointsAvailable`), same as the single-hero Planner (PR #34). `HeroPlanContext`
and `TeamPlanHeroInput` gained a `statPointsAvailable` field, threaded into both of the solver's
points passes (`solver-search.ts`'s `pointsPass`, `waterfall.ts`'s `finalPtsFromOptimizeBuild`) as
`ReoptInput.statPointsAvailable`. Previously the Team Plan solver always called
`findGateCandidate`/`optimizeBuild` with the field defaulted to 0, so a hero with banked points
could get different point-allocation advice from the Planner than from the Team Plan page for the
same account state — the Team Plan run silently ignored the banked points.

---
"@bombfarm/domain": patch
---

Prune strictly-dominated spare gear from the team-plan search, and lower the evaluation budget to 250,000 now that it converges. At the same set and level a higher rarity is always superior, and on the same item a higher forge is — so those candidates can never win and no longer cost an evaluation. On a real 441-item save the plan improves 10% (4.489e+11 to 4.952e+11) while taking a third less time, and the search now reaches convergence instead of always being cut off.

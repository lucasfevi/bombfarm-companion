---
"@bombfarm/domain": patch
---

Drop strictly-dominated spare gear from the team-plan search. At the same set and level a higher rarity is always superior, and on the same item a higher forge is always superior, so those candidates can never win on any hero. Combined with the interchangeable-item dedup this cuts assign candidates to a third, and the search now reaches a converged plan instead of always being cut off by the evaluation budget.

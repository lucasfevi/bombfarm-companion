---
"@bombfarm/domain": patch
---

Stop the team-plan search evaluating interchangeable spare gear more than once. Every copy of an item with the same def, rarity, level and effective forge produces a byte-identical equipped item and so an identical objective; only one now enters the candidate list, with multiplicity still tracked by the pool. On a real 441-item save that cuts assign candidates to 45% and reaches the same plan in half the evaluations.

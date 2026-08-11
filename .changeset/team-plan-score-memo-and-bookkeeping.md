---
"@bombfarm/domain": patch
---

Cut team-plan runtime roughly in half without changing a single result. The per-hero score memo lived inside `evaluateRoster`, so a candidate differing in one hero's gear rescored all fifteen from scratch; it now spans the whole run, where 97.1% of score lookups hit a key already computed (the previous per-call memo hit 0.0% of the time). Profiling the result showed the search had become bookkeeping-bound rather than math-bound — building memo keys cost ~29% of a run and recomputing team auras 14%, against 0.4% for the actual scoring — so the ability-catalog lookup is now resolved once, the forge-floored loadout is built once per evaluation instead of once per fixed-point round, and the key builders walk fixed key lists instead of sorting object entries. On a real 348-item, 15-hero save the plan takes 122 s instead of 167 s at the full budget, and the emitted plan is byte-identical at every budget.

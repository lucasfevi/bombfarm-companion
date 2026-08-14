---
"@bombfarm/domain": patch
"@bombfarm/web": patch
---

**Optimize build and the Team Plan now respect the hero's level.** A hero with banked, unspent
stat points could be walked far past its own level: a level-46 hero with 46 unspent points got a
46-point build on the first Optimize, then 92 on the second, 138 on the third — and the Team Plan
page's Point Reset table inflated the same way, on top of whatever the Planner had already
proposed. The Points panel's `spent / level` counter went red and stayed red, while the `+/-`
steppers refused the very spend the optimizer had just made.

The budget was `budgetOf(pts) + statPointsAvailable`. That second term is what the save reported
as banked at import time — a snapshot of `level - spent` — and it never shrank as those points
got spent in the planner, so every Optimize -> Apply round counted them again.

It is replaced by two budgets, because the two searches answer different questions:

- **Optimize build** ("what is the best build?") gets `reoptBudget(pts, level)` —
  `max(level - pts.luck, budgetOf(pts))`. The hero's whole pool, matching the ceiling
  `clampPointStep` has always enforced for the manual steppers, floored at what is already
  placed so a hero whose level was lowered after spending can still reallocate what it holds.
- **The reset gate** ("is a real in-game reset worth buying?") gets `budgetOf(pts)`. A reset only
  moves points that are already spent, so a hero with points still unplaced no longer gets a
  respec recommendation it has no use for — the Points panel's unspent counter and the Optimize
  button are what surface that hero's actual next action. This also quiets the roster banner and
  the Points warn dot for freshly imported, unallocated heroes.

Neither budget can compound: each search places at most what it was given, so feeding a result
back in is non-increasing and settles immediately.

`ReoptInput` takes `level` in place of `statPointsAvailable`; `HeroPlanContext` and
`AdvisorPipelineInput` drop the field entirely, so the stale value cannot be threaded back in.
`HeroRecord.statPointsAvailable` is unchanged and still persisted — it remains what the save
reported, which is what `point-inference.ts`'s budget-mismatch check reads. The Points panel's
"+N unspent" note is now derived live from `level - spentDelta`, so it stops advertising points
that have since been spent, and the disabled-Optimize reason no longer says "nothing spent to
move" for the one case that is now enabled.

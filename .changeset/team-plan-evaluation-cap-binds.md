---
"@bombfarm/domain": patch
---

Team Plan stops at its evaluation budget instead of two evaluations past it

The budget was checked only after an evaluation had already been charged, and two more could still
be in flight when it tripped: a points pass after the gear pass had spent the last of the budget, and
the closing points pass. On the committed fixture that meant a search told to stop at N evaluations
did N+2 at every budget tested.

Nobody would have noticed the two evaluations. What they buy is the reason to fix it: on a roster
whose search runs out of budget, those unbudgeted passes were where the last improvement came from,
so the budget did not bound the work and the plan quietly depended on overrunning it. A search that
exhausts its budget now returns what it had when the budget ran out, which is what an exhausted
budget is supposed to mean.

A budget of zero still costs one evaluation: the search has to price the roster it started from
before it can return or compare anything.

No plan a converging search produces changes — all three committed reference plans converge well
inside the budget and are byte-identical. A roster that exhausts the budget may now get a very
slightly less optimised plan than before, and never one worse than the roster it started from.

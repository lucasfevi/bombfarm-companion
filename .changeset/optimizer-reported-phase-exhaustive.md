---
"@bombfarm/domain": patch
---

The phase the Optimizer tells you to farm is now the best one, not the best one a shortcut found.

Scoring for gold sweeps every phase to find the one your squad earns most at. That sweep has a fast path — check each world's opening phase, then look closely around the best of them — which is the right trade while the search is trying thousands of builds, because a near miss just costs it a slightly worse candidate. It was the wrong trade for the answer you read: a world's opening phase does not tell you what its best phase is worth, so the shortcut can settle a world or two away.

Measured on the committed captures over randomized point spreads, it disagreed with a full sweep on about 2% of squad states, and in one of them named **phase 51 where the true best is 33** — 2% of the gold, and two worlds off the advice.

The plan's own figures are now taken from a full sweep. The search keeps its fast path, so runs do not get slower in any way you would notice: the sweep now runs a handful of extra times per plan, against the thousands of evaluations the search itself spends.

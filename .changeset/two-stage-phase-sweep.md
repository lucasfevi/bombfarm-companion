---
"@bombfarm/domain": patch
---

Speed up the farm respec search by screening the phase table one world at a time instead of
sweeping it row by row.

The phase argmax was 96% of the cost of a farm evaluation, and the solver runs thousands of them
per press of Optimize. It scanned every phase from 1 to the account's ceiling, once per candidate
build. The phase table has structure that scan ignored: a world is ten phases long and the tenth
is its gate, so phases 1, 11, 21 and so on are each the first phase after a boss — the point where
the economics step, and hardest at an act boundary, where monster HP holds flat across the gate
while the gold per prop doubles (188 to 375 from phase 50 to 51). The search now evaluates the
openers, then refines every phase within one world either side of the best of them.

Screening is a heuristic, not a shortcut to the same answer: an opener's score does not bound its
world's peak, so a world that screens low can still hold the best phase. Measured over randomized
squad states it picks a different phase 0.5% of the time, costing up to 1.6% of the objective when
it does. The screen is therefore confined to the search, where a miss only sends it down a
slightly worse path. Every phase the app reports — the recommended and current phase, the gold and
chest rates, the gain, the payback, the plateau, the cheaper-respec frontier, and the Next Point
ranking — is resolved by the full linear sweep, unchanged.

On the committed captures the search reads between 1.27x and 4.21x fewer phase rows, the saving
growing with the account's phase ceiling.

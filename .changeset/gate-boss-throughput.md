---
"@bombfarm/domain": patch
"@bombfarm/web": patch
---

Charge gate rows for the boss's seconds.

A gate cycle is the map plus the boss, and the boss drops no props. `clearSecs` counted it; `propsPerHour` did not — it was `3600 × propsPerSec`, the raw prop-clearing rate. The two numbers on a single row therefore described different clocks, and because gold, chests, keys, gems, time pieces, stone chests and XP are all `propsPerHour × <per-prop>`, every one of them read high on every gate by the boss's share of the cycle.

That share grows with phase, because the boss's HP multiplier outpaces a squad's damage faster than the props do: about 2% at the first gate, 7–8% by the fifties, and 10% at the late ones on both accounts measured. A phase-130 gate printed roughly 10% more gold per hour than its own clear time allowed.

`propsPerHour` is now derived from the cycle (`cyclesPerHour × propsPerMap`), so it always agrees with the row's `clearSecs`. Non-gate rows are unchanged to the bit — the two expressions are algebraically equal off a gate but not bit-equal in IEEE754, so the branch is kept rather than simplified.

Ranking shifts slightly against gates as a result, which is the point: gates were being credited with loot they had no time to collect. On the test corpus the best solo phase moves from the gate at 30 to 29, which pays 101.8k/h against the gate's corrected 94.7k/h.

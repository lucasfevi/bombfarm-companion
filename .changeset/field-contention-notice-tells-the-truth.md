---
"@bombfarm/domain": patch
"@bombfarm/web": patch
---

Stop the field-contention notice giving impossible advice and denying its own math.

The banner told every contended player two things that are no longer true. It said the gold/hr estimate does not model the wait, which stopped being the case one PR later, when `concurrencyScale` became the queue's served share `E[min(fieldSlots, X)] / E[X]` and started charging exactly that wait into every rate on the board — the copy was never updated with the math under it. And it prescribed more field slots unconditionally, which is not advice to a player already holding the maximum of nine.

It now reports the cost instead of denying it. The two figures diverge hard and that is the point: on a 14-hero roster at 9 slots somebody is benched 26.1% of the wall clock, and it costs 1.2% of the rate, because a saturated queue is not an idle one. A player reading the frequency as the loss overstates it twentyfold.

At the cap, a second variant says the wait is structural and names no purchase. It reads the existing `FIELD_SLOTS_MAX`, and the doc there now records the property that makes it safe to consume: it is a ceiling to REPORT against, never a clamp. `resolveFieldSlots` still records whatever the save carries, so a patch that raises the track shows up as a value above nine rather than being truncated to it.

No rate changes, and no behaviour change in `@bombfarm/domain` at all. `concurrencyScale` and `fieldContentionPct` are untouched — the cost the banner now prints is a factor the board already applied.

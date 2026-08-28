---
"@bombfarm/desktop": patch
"@bombfarm/contracts": patch
---

The live tick stream now folds gold and XP into a measured per-hour rate, entirely in the main
process: a sequence-guarded accumulator tracks payouts against a 10-minute rolling window and the
whole session, with a second independent check that grid-clear counts and payout counts agree. The
result publishes on the existing live fast channel as `LiveView.earnings`, and a
`live:resetEarnings` call lets the session figures be zeroed without disturbing the rolling window.

This is the data layer only — no panel reads it yet, so there is nothing new on screen.

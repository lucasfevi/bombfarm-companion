---
"@bombfarm/domain": patch
---

Adds a wall-time guard to the farm respec solver's performance suite. The existing budget assertion
counts evaluations, which cannot catch a change that keeps the count identical and makes each
evaluation more expensive — the exact shape of a recent cadence-math change. The new case asserts
the best of three full solves on the committed 5-hero fixture stays inside a generous ceiling, with
the measured baseline recorded alongside it. No behavior change.

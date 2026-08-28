---
'@bombfarm/domain': patch
---

Make capture-regime admissibility mechanical, and restore the farm ranking's lost discrimination
subjects.

Test-and-fixture work only — no shipped behaviour changes. The corpus now declares, per capture,
which regime it was taken under and which mechanics it may still be the source of a number for
(`packages/domain/tests/helpers/capture-regime.ts`), enforced in both directions by a new guard.
Two in-regime captures land with it, one of them holding both sides of the one-shot contrast the
farm ranking suite is built around; 42 of 58 disabled tests come back, each finding re-asked of a
different account before being re-enabled rather than re-recorded. See `docs/fixture-corpus.md` §11.

---
"@bombfarm/domain": patch
---

Make capture-regime admissibility mechanical, and restore the farm ranking's lost discrimination
subjects.

Test-and-fixture work only — no shipped behaviour changes. The corpus now declares, per capture,
which regime it was taken under and which mechanics it may still be the source of a number for
(`packages/domain/tests/helpers/capture-regime.ts`), enforced in both directions by a new guard,
with waivers verified against the capture's own heroes and retention held to a hard bound.

Two in-regime captures land with it — one a second account with a House that binds, the other
holding both sides of the one-shot contrast the farm ranking suite is built around. All 58
disabled tests are resolved: most re-pointed with their finding re-asked of a different account
first rather than re-recorded, three recorded as losses with the measurement that killed them, and
two frozen refactor-parity artifacts deleted outright because the refactors they proved had long
since shipped. Two synthetic fixtures had drifted the same way as the captures and were recomputed
from the current model. See `docs/fixture-corpus.md` §11–§12.

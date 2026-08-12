---
"@bombfarm/contracts": minor
"@bombfarm/domain": minor
---

Add a source-neutral account payload contract and route save-file parsing through it.

`@bombfarm/contracts` gains `AccountPayload` plus its per-section fidelity types
(`AccountSection`, `SectionStatus`, `SectionFidelity`, `AccountFidelity`, `AccountFidelityGrade`,
`AccountFidelityReport`) — the typed shape both the web upload path and the future desktop
live-memory reader (MP2 F2) will target. It declares no `export_version` / `generated_at`; those
stay file-only.

`@bombfarm/domain`'s `parseSaveFile` is now a five-line file adapter over a new exported entry
point, `parseAccountPayload(payload, existing)`, which takes the typed payload directly instead
of a raw file object. The ~250-line parsing body itself did not move, change, or reorder — only
the wrapping changed. A new `deriveAccountFidelity` (with the `ACCOUNT_SECTIONS` constant) turns
a per-section fidelity block into one overall grade (`full` / `degraded` / `unavailable`) plus the
list of degraded sections; it is pure, with no I/O.

No behaviour change for the web planner: `parseSaveFile`'s name, signature, and exact output
(including warning strings and their order) are unchanged, proven by a digest against the
pre-refactor result on the canonical fixtures, and by all 74 existing `apps/web` import tests
passing byte-unchanged. `@bombfarm/web` is not listed above — it picks up an automatic patch
from the `@bombfarm/domain` dependency bump, but nothing a planner user can observe changed.

---
"@bombfarm/domain": patch
---

Broadens `export-fingerprint.test.ts`'s corpus check from one hardcoded save-export capture to
every committed one. `tests/fixtures/sheet-math/` is walked at run time and filtered to save
exports by a content-based signal (`export_version` + `generated_at` both present on the parsed
object) rather than a filename guess, so `payload-*.json` (a different, API-assembled shape) is
excluded without naming it, and a newly ingested capture is swept without editing this file.

Test-only: no runtime source changed. Non-vacuity is asserted two ways — the sweep must find more
than one save-export capture, and every currently-known capture's filename must be among those
discovered, so a rename or an accidental narrowing of the walk fails loudly instead of silently
shrinking the corpus checked. The three named RED-state mutation tests stay on one representative
capture (the historical 2026-08-13 file) rather than running against every corpus member: they
exercise `checkSchema`'s missing/added-key discrimination, a property of the schema engine itself,
which the broadened GREEN equality sweep already proves holds per file. `EXPORT_FINGERPRINT`'s own
`sourceArtifact` provenance is unchanged — it still names the 2026-08-13 capture the key set was
authored from, which is independent of how many captures are now checked against it.

---
"@bombfarm/domain": minor
"@bombfarm/desktop": minor
---

**The desktop renders real hero planning advice with the game closed.** A new Planning tab
(`AppShell` nav) reads the already-persisted `AccountView` once on mount and shows the roster,
each hero's next-point ranking, and reset advice, computed through `@bombfarm/domain`'s advisor
pipeline — the same engine the web planner runs.

`packages/domain/src/roster-dps.ts`'s `pipelineForHero` is now a public export (`AD-032`): the
only `HeroRecord`-shaped entry to the pipeline, and the one mapping both surfaces use. Its body is
byte-unchanged; a layer-1 parity test (`packages/domain/tests/pipeline-for-hero-parity.test.ts`)
and a layer-2 source-derived key-set guard (`tools/advisor-input-parity.test.mjs`) together prove
the desktop and the web compute identical ranked stats and gains for the same account payload,
for every observed `crit_dmg_mult`. The one known, pinned divergence (`treeCritDmgMult`, `AD-038`)
is documented at the export site and asserted not to widen or silently close — it is not fixed
here, because doing so would change the web planner's own rendered numbers.

**Honesty over completeness, by construction (`D24`).** Every number the desktop shows is gated
by the usability of the account sections it depends on (`resolved`/`stale` render; `missing`/
`degraded` withhold, never a fallback). An exhaustive, table-driven matrix
(`apps/desktop/renderer/lib/planning/withhold-matrix.test.ts`) asserts the fallback numbers
`import-save.ts`'s zero-tree default would otherwise produce are never reachable when their
backing data is not trustworthy.

**No behaviour change for the web planner.** `apps/web` is untouched — zero files changed, source
and tests alike. `packages/ui` is untouched too (`DS-09` intact): every control on the new screen
composes existing `@bombfarm/ui` primitives.

Two known, recorded limitations ship with this feature rather than being silently claimed:
`degraded` sections are implemented and unit-tested but currently unreachable end to end (the
account-restore merge prefers a stale body over a degraded live read, `AD-037`); and the manual
refresh affordance (`account:refresh`, `READ_PACING.manualRefreshFloorMs`) was not taken in this
pass and remains unimplemented, not merely deferred.

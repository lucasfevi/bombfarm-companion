# @bombfarm/desktop

## 0.4.1

### Patch Changes

- ab3d19e: Open the desktop app on Planning, and keep the raw payload view out of shipped builds

  The app opened on Diagnostics — a dump of the raw account payload — so the first
  thing anyone saw was JSON rather than their roster. It now opens on Planning.

  Diagnostics itself is a maintainer's tool, and it is no longer offered at all in
  the production flavor; the development flavors keep it. Until the flavor is
  known it is treated as production, so a shipped build never flashes the tab into
  its sidebar and then removes it.

- 673676c: Stop the desktop app re-rendering itself twenty times a second

  While the game was running, the app rebuilt its whole window on every poll —
  fifty milliseconds apart — whether or not anything had changed. Two things
  caused it, and both mistook "we read this again" for "this is different": the
  status carried the time it was read, and comparing the whole status object made
  every read look like a change; the renderer then re-applied that status a second
  time from each snapshot push.

  Neither the read time nor the re-application is visible anywhere in the app, so
  nothing on screen changes — a quiet window now costs about half the component
  renders it used to.

- b1e2591: Stop a harmless added field from hiding DPS, next-point ranking and reset advice

  A game update that only adds a field this app doesn't read used to be treated exactly like one
  that removes a field it does read: either kind of shape drift made the desktop withhold DPS,
  next-point ranking and reset advice for every hero, even though nothing the planner actually
  needed was missing. Now those two cases are told apart. A drift that only adds fields is
  harmless — nothing read was lost, so advice keeps rendering as normal, just flagged as drifted.
  A drift that drops a field this app reads still falls back to the last good reading instead of
  computing from an incomplete body (and guessing at the missing value), exactly as it did before
  shape drift got its own status.

- b1e2591: Keep per-hero rotation state, and stop a cosmetic shape change from blanking a whole account section

  The `/rotation` read used to keep only its `casa` (house) sub-object and discard the rest of the
  body — the field list and, most importantly, each hero's in-field/energy/recovery state, even
  though that state was already being validated. That data now reaches storage.

  Separately, any account section whose response shape drifted from what this app expects (a game
  update adding or removing a field) used to be dropped entirely for that cycle, even when the data
  that mattered was still there — a mismatch was correctly detected, but the section was then
  processed as if the source hadn't answered at all. A drifted section that still holds a usable body
  is now kept and reported as degraded (naming the keys that changed), rather than discarded. A
  section that lost the very data it needs still reports missing, unchanged.

- Updated dependencies [7772ae0]
- Updated dependencies [b1e2591]
- Updated dependencies [b1e2591]
- Updated dependencies [f2d6231]
- Updated dependencies [635abe3]
- Updated dependencies [b1e2591]
- Updated dependencies [b1e2591]
  - @bombfarm/domain@0.6.1
  - @bombfarm/contracts@0.3.2
  - @bombfarm/game-api@0.2.2
  - @bombfarm/game-data@0.0.5

## 0.4.0

### Minor Changes

- 4fcaa1a: Fixes five compounding errors in the team-aura model, confirmed against the maintainer's own
  roster: **a team aura is a property of the FIELD, not of any one hero.** Every deployed hero —
  carrier or not — experiences `min(cap, Σ every carrier's rank)`. Two rank-20 Fôlego de Mineiro
  carriers give −20%, two rank-10 carriers give the same −20%, and a non-carrier standing next to a
  rank-20 carrier also reads −20% — never −40%, never −20%×2, and never 0% just because it happens
  to be a non-carrier.

  **Contra o Relógio was never a team aura.** The wiki's `kind` prefix (`gate_power`, not the
  `team_*` every genuine aura carries), its own "Só ele" scope column, and this catalog's
  `effectText` (missing the "do TIME" every real aura has) all agree it is self-scoped — a hero's
  own gate-phase attack bonus, not a team-wide one. It is removed from `TEAM_BUFF_ABILITY_IDS` /
  `TEAM_BUFF_FIELDS` / `zeroTeamBuffs()`; `gateAttackMult` reads the hero's own ability ranks alone.
  This was a live double-count reaching the shipped gate advisor, not an inert modelling gap. A
  stored roster's `teamBuffs` blob may still carry an old `contra_relogio` key — it is a loose
  `Record<string, number>`, so the orphaned key is read harmlessly and never again.

  **A hero's own rank was double-counted against the team total.** `abilityMods` used to fold a
  hero's own Grito de Guerra / Marcha Acelerada / Fôlego de Mineiro / Presságio Mortal rank into its
  own combat mods, and the team's total was then stacked on top — so a carrier's own investment
  counted twice once any other carrier was on the field. `abilityMods` no longer touches any of the
  four team auras at all: they are accounted for ENTIRELY through the roster-wide total, which
  already includes every carrier, this hero included. The four abilities that share an effect kind
  with a genuine self ability (Fôlego/Bateria Extra on `drainPct`, Presságio/Olho Clínico on
  `critChancePctOfBase`) now split cleanly on ability id/`onSheet`, not on a shared, pre-folded
  multiplier.

  **`computeTeamBuffsFromDeployed` used to exclude one hero, so the total every OTHER hero read
  depended on who that was.** With one rank-20 carrier, excluding it left every other hero reading
  0% where the rule gives 20% — a UI-state-dependent answer to a question that has nothing to do
  with UI state. It no longer takes an `excludeHeroId`: it sums every deployed hero, excluding
  nobody, and returns the RAW total (the cap applies once, at the combination site
  `computeCombatMults`, so the stored/displayed figure can still show a true over-cap sum). The
  planner's hero editor needed the old exclusion to make a live rank edit move that hero's own DPS
  preview; it now gets the same effect from `substituteHeroAbilities(total, oldRank, newRank)` —
  substituting the edited hero's own contribution into the stored total instead of ever excluding it.

  **The cap was global and five times too generous.** The old cap clamped every aura at a single
  +100% figure attributed to a `combate.team_mult_bonus_cap` wiki key that does not exist — not in
  the live wiki payload, not in this repo's own drift capture. The real cap is per ability
  (`TEAM_BUFF_CAP`): Grito de Guerra and Fôlego de Mineiro cap at 20, Marcha Acelerada at 3.7,
  Presságio Mortal at 114.28571428571428 — each ability's own rank-20 maximum, not a shared
  constant. Five fielded rank-20 Fôlego carriers used to drive drain to a 100×-optimistic floor;
  they now cap at one carrier's worth.

  **The roster-wide total is now DERIVED by default, not a stored field starting at zero.** Once
  `abilityMods` stopped folding a hero's own rank into its own mods (above), the account's
  `teamBuffs` value became the ONLY source of any team-aura benefit — and that value defaulted to
  an all-zero `zeroTeamBuffs()` that nothing populated on import. A carrier's aura genuinely applied
  to nobody, including itself, until a user found the Account panel's auto-fill button by hand: a
  regression in shipped default behavior, not a modelling nuance. The farm board and the live
  advisor preview now read `computeTeamBuffsFromDeployed(heroes)` — the same pure roster total the
  auto-fill button always wrote — whenever the account carries no explicit override, so a fresh
  import shows the real total its own roster carries. The Account panel's manual fields remain a
  genuine override: editing one, or pressing Reset (an explicit all-zero override, distinct from no
  override at all), still pins the account to that exact figure regardless of later roster changes,
  exactly as before. A pre-existing local save's stored `teamBuffs` migrates on next load: an
  all-zero value (the old ubiquitous, never-touched default) is indistinguishable from "never
  touched" and becomes derive-by-default; any value with a genuinely nonzero entry was a real
  auto-fill snapshot or hand edit and carries forward as an explicit override, unchanged.

  **The desktop app had the same regression, with no button to work around it.** It has no
  team-buffs UI at all, so `AccountShared.teamBuffs` there was hardcoded to `zeroTeamBuffs()` as a
  placeholder for a dimension it did not model — harmless while a hero's own rank still self-applied
  regardless of that placeholder, but not once the self-fold above was removed: every desktop hero,
  including a carrier itself, started reading zero team-aura benefit with no way to correct it. The
  desktop's advice pipeline now derives the same `computeTeamBuffsFromDeployed(heroes)` total from
  its own roster on every rebuild — always derived, no override, since there is nothing on the
  desktop for an override to record.

  **Internal (no shipped behavior change): the account-486 throughput anchor is retired.**
  `farm-rate-486-anchor.test.ts` pinned `goldPerHour` against telemetry captured beside a save that
  predates both the 2026-08-15 crit-chance/CDR shape change and the 2026-08-16 item-slot
  redistribution — sheet math this repo already declares unreproducible
  (`points-within-level-budget.test.ts`'s `NON_CURRENT_REGIME_CAPTURES`). Re-pinning it to whatever
  this fix's model now produces would have anchored a fresh-looking number to a stale target, so the
  file is deleted rather than recalibrated (issue #137); its fixture stays committed for the
  structural suites that still read it for roster shape. A new in-regime anchor,
  `farm-rate-phase51-ato2-anchor.test.ts`, pins the same link-by-link chain against a post-revert
  capture (`sheet-math/save-20260818-12heroes.json`, phase 51) and 61 freshly-logged clears; its
  `heroesOnField`/`clearSecs`/`goldPerHour` carry a documented, left-open ~6-8% residual attributed
  to partial team-aura coverage across a farming rotation (issue #138) rather than tuned away.

  **What moves in the planner**: any roster with two or more carriers of the same team aura sees a
  lower (correctly capped) bonus than before; a non-carrier standing with a carrier now correctly
  receives the SAME bonus the carrier does, where it previously received none. A fresh import, or
  any account that never pressed auto-fill or edited a team-buff field by hand, now shows its
  roster's real team-aura total immediately instead of a blank zero panel. A roster with at most one
  total carrier per aura, no Contra o Relógio contribution to the gate advisor, and an explicit
  account-level override already on file, is unaffected in shape.

### Patch Changes

- Updated dependencies [5025de1]
- Updated dependencies [3d0d97b]
- Updated dependencies [5770a5e]
- Updated dependencies [f5671be]
- Updated dependencies [ab1c1b9]
- Updated dependencies [06bcc05]
- Updated dependencies [54fcaa3]
- Updated dependencies [d6ec791]
- Updated dependencies [387f85c]
- Updated dependencies [dfa285a]
- Updated dependencies [5a742c9]
- Updated dependencies [5a742c9]
- Updated dependencies [dd793f0]
- Updated dependencies [37c30bf]
- Updated dependencies [37c30bf]
- Updated dependencies [37c30bf]
- Updated dependencies [687aacb]
- Updated dependencies [c6f077e]
- Updated dependencies [796ce3b]
- Updated dependencies [0418a82]
- Updated dependencies [0418a82]
- Updated dependencies [4fcaa1a]
- Updated dependencies [20f53bb]
- Updated dependencies [5a742c9]
- Updated dependencies [bbd5397]
- Updated dependencies [3e2cf46]
- Updated dependencies [3e2cf46]
- Updated dependencies [c8a3bc8]
- Updated dependencies [3d0d97b]
- Updated dependencies [71fb344]
- Updated dependencies [37c30bf]
- Updated dependencies [590a5e9]
- Updated dependencies [387f85c]
- Updated dependencies [4fcaa1a]
- Updated dependencies [560f83d]
  - @bombfarm/domain@0.6.0
  - @bombfarm/ui@0.4.0
  - @bombfarm/contracts@0.3.1
  - @bombfarm/game-data@0.0.4
  - @bombfarm/game-api@0.2.1

## 0.3.0

### Minor Changes

- 1fa3def: **The desktop's advice now updates by itself.** When a poll shows a hero's gear, level, stars,
  abilities or the skill tree changed, the on-screen advice recomputes and updates within one
  refresh cycle — no restart, no re-navigation, no manual refresh button. When nothing
  planning-relevant changed, the advice does **not** recompute: a scripted sequence (identical,
  relevant change, irrelevant change, identical) asserts the recompute counter moves exactly `1, 2,
2, 2`, the spec's own Independent Test verbatim.

  `account:changed` now fires only when the account genuinely changed, not on every poll cycle. A
  new pure export, `accountChangeKey(payload: AccountPayload): string` (`@bombfarm/contracts`,
  zero new dependencies), is the one canonical, `capturedAt`-blind change key both the main process
  (gating the `account:changed` emit) and the renderer (gating which pushed/fetched view is
  accepted) compare against. A second, exact key — `heroChangeKey`/`sharedChangeKey`
  (`apps/desktop/renderer/lib/planning/hero-advice.ts`) — decides which heroes actually recompute:
  a one-hero gear change recomputes that hero only; a shared-tree change recomputes every hero,
  correctly.

  A section leaving `resolved` (`stale`/`missing`/`degraded`) withdraws its dependent numbers in the
  same render as the status change, never one cycle behind; a section returning to `resolved`
  recomputes from the new data, never from a pre-degradation cache.

  The full 11-hero recompute completes in ~1 ms (measured), asserted against a 16 ms budget — one
  60 Hz frame, the threshold below which the recompute cannot delay the Electron main event loop or
  drop a renderer frame.

  **No behaviour change for the web planner.** `apps/web` is untouched — zero files changed, source
  and tests alike. `packages/ui` and `packages/domain` are untouched too: the recompute stays in the
  renderer, memoised: only the change _decision_ moved to main, and no worker was introduced in
  either process.

- f0bf7f4: `@bombfarm/domain` is now consumed as a **built package** (`dist/` + `.d.ts`), the same way
  `@bombfarm/contracts`, `@bombfarm/game-api`, `@bombfarm/game-data` and `@bombfarm/pricing`
  already are, instead of advertising its TypeScript source through `exports`. This is a
  packaging contract change, not a math change: not one byte of `packages/domain/src` — the
  sheet math MP2's fidelity gate protects to a worst error of `1.1e-11` — was touched. The
  package's `exports` map now targets `dist/**` (four directory subpaths — `./gear`, `./model`,
  `./stat-breakdown`, `./team-plan` — plus a `./data/*` JSON target and a file/nested-file
  wildcard), and a new packaging test proves every in-use `@bombfarm/domain[/subpath]` specifier
  in the repo resolves through Node's own module resolver, not just by reading the map.

  **The desktop can now compute with the planner engine.** `@bombfarm/desktop` declares
  `@bombfarm/domain` as a real `workspace:*` dependency (it previously resolved only by
  accident, via pnpm's root-level hoisting) and imports it from both processes: the main process
  computes a value through the built package under its own strict TypeScript bar
  (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`), and the renderer renders one
  domain-derived label. Neither import adds any planning UI, recompute, or i18n wiring — that is
  later MP3 work (F2/F3/F4). This feature only proves the edge compiles, bundles (esbuild inlines
  the domain code; the desktop's own long-running team-plan solver is confirmed absent from the
  bundle), and reaches the DOM.

  **No behaviour change for the web planner.** `apps/web` keeps resolving `@bombfarm/domain`
  through its existing tsconfig `paths` and bundler aliases — it never reads the new `exports`
  map — and zero files under `apps/web` changed in this release. A guard test now pins those
  resolution entries so a future cleanup cannot silently move the public planner onto `dist`,
  which Vercel's production build never produces.

  `docs/typescript-planner-origin.md`'s documented strictness exception for `@bombfarm/domain`
  and `@bombfarm/ui` is unchanged in scope — the same two packages, the same ESLint globs. A
  consumer built against `dist` never compiles domain's source under its own relaxed bar at all,
  so this packaging change is orthogonal to that exception rather than an extension of it.

- e78122a: **The desktop now speaks English and Brazilian Portuguese throughout.** It defaults from the
  system language (every Portuguese OS locale variant — `pt-PT`, `pt-AO`, bare `pt` — resolves to
  the one Portuguese translation that exists), is switchable at any time from a new Settings tab,
  and the choice is remembered across restarts. Every screen — navigation, status chrome, planning
  views, fidelity messages, empty states, errors — renders from one typed, compile-time-checked
  string source per language; a key present in only one language fails the build rather than
  shipping a half-translated screen.

  Game terms (hero rarity today; ability/house/slot/set names as the shell grows to render them)
  follow the chosen language through `@bombfarm/domain`'s existing `game-labels.ts` helpers — the
  underlying stored key is unchanged, localisation is display-layer only. Numbers and relative-age
  text follow the locale too: DPS and counts group thousands the PT-BR way (`1.234` vs `1,234`), and
  next-point gains sign and format per locale (`+1,5%` vs `+1.5%`).

  A language switch is a display change, never an account change — it triggers no refresh and no
  advice recompute, proved both structurally (the locale cannot enter any change key) and by a
  compute-count assertion. If the chosen language cannot be saved (a read-only save location), the
  language still applies for the session and the failure is surfaced, rather than silently
  reverting on the next launch.

  `packages/contracts` gains `AppLocale`, `DOMAIN_LANG_BY_LOCALE`, `BCP47_BY_LOCALE`,
  `resolveStartupLocale` and two verb-shaped settings channels — the one place the desktop's locale
  token maps to the domain's language and to `Intl`'s BCP-47 tags; the existing `contextBridge` is
  unchanged (zero-argument channels, following the shipped consent quartet's shape).

  **No behaviour change for the web planner.** `apps/web` is untouched — zero files changed, source
  and tests alike — and its own `Lang`/`bf_lang`/`pt` default and namespace files are unaffected.
  `packages/ui` and `packages/domain` are untouched too: four English `aria-label`s inside
  `packages/ui` (`AppShell`'s nav landmark, `Num`'s increment/decrement) and the `ConsentModal`'s
  legal disclosure stay English by design — `packages/ui` may not change, and the consent text's
  `textVersion` means a translated rendering could constitute wording the player never agreed to.
  Both are pinned, named exceptions, not oversights.

- 96d496a: **The desktop renders real hero planning advice with the game closed.** A new Planning tab
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

### Patch Changes

- 2dcfb73: Fixed an uncaught main-process exception on shutdown in fixture-mode game reading
  (`BFC_GAME_READER=fixture`, test infrastructure only — the real memory-mode reader never writes
  to SQLite and was never affected). A tick that reached `AccountStore.commit()` after the account
  database had already closed threw `Error: database is not open`; because no code path caught it,
  Electron surfaced its default "A JavaScript error occurred in the main process" modal, which
  blocks process exit. On an unattended CI runner this held the process open until Playwright's
  worker teardown gave up at 120s — the intermittent `smoke-windows` flake seen on roughly a
  quarter of `develop` pushes.

  Two changes close this off. `GameReaderService.tick()` now wraps the fixture path in the same
  try/catch that already recovered a memory-mode tick failure (previously only `tickMemory()` was
  guarded, so a fixture-path throw had no recovery path at all), and `stop()` now latches a
  `stopped` flag that makes any further tick a no-op immediately — not just reliant on
  `clearTimeout` having already run — so a tick can never reach the account store once shutdown has
  started. `AccountStore` also gets a defensive closed-guard: `persist()`/`restore()`/`commit()`
  after `close()` now report "unavailable" instead of throwing the SQLite driver's raw error, and
  `close()` itself is idempotent. `apps/desktop/src/main/index.ts`'s `before-quit` handler already
  stopped the game reader before closing storage; that ordering is now documented as load-bearing
  rather than incidental.

- a0a126b: **The pre-v4 capture corpus is removed and replaced.** The 2026-08-13 patch removed all five
  keystones and wiped every account; the 41 committed capture files this repo's test suites were
  built on described an account the game can no longer produce. The 20 quarantined suites (the
  files carrying the catalog-v4 quarantine header) and all 39 stale `sheet-math` fixtures (plus the
  old fidelity-gate capture pair) are deleted, and the ~30 surviving suites that depended on them
  are re-pointed onto a new, post-patch corpus: a scrubbed 2026-08-13 save export
  (`save-20260813-5heroes.json`, 5 heroes) and an already-committed API-assembled payload
  (`payload-20260812-8heroes.json`, 8 heroes). The fidelity-gate capture pair is re-captured from
  the new export and its eight-mutant discrimination suite is re-proven red against it.

  **No runtime behaviour changes for the web planner or the desktop.** This is a test-fixture and
  test-suite rebaseline only — `packages/domain/src`, `apps/web/src` (non-test) and `packages/ui`
  are untouched. `@bombfarm/desktop` is included because its recompute-budget test reads a fixture
  this feature deletes (`apps/desktop/renderer/lib/planning/recompute-budget.test.ts`), not because
  any desktop-rendered number changes.

- 453ed05: **The drift guard can now see the change it was built to catch.** The 2026-08-13 game patch
  reshaped `skills.totals` and the mechanism meant to notice — `fingerprints.ts` — ran on every CI
  job and passed, because it only checked top-level key presence and never treated an added key as
  a failure. This change deepens the guard and uses it to reject stale data on both surfaces.

  **Deepened fingerprint (`@bombfarm/domain`, `@bombfarm/game-api`):** the schema check now descends
  into declared nested paths (`skills.totals`, `heroes[]`, `items[]`, `casa`, `account`) instead of
  only the top level, and an **added** key is now fatal at every declared level, not only a missing
  one. The five API route bodies and the save-export file's own shape are fingerprinted from one
  shared key catalogue. `RouteFingerprint.requiredKeys` (a flat, subset-checked list) is gone;
  `checkShape` no longer has an `{ ok: true, unknownKeys }` branch.

  **New rejection reason (`@bombfarm/domain`, `@bombfarm/web`):** importing a save file now checks
  for the presence of the patch's new keys (`skills.refunds`, `skills.totals.vagas_campo`,
  `skills.totals.bag_tabs_bonus`) before parsing. A save missing them — pre-patch or truncated — is
  rejected with a new generic message, in EN and PT-BR, that names no keystone, version, date or
  field path so it stays accurate after the next patch. The specific missing keys are still recorded
  in `ParseResult.warnings` for diagnosis.

  **Two drop rules, never a migration (`@bombfarm/web`, `@bombfarm/desktop`):** a locally stored
  planner account on the web, or a stored SQLite account section on desktop, that still carries a
  retired keystone field (or fails its own fingerprint) is dropped and deleted rather than served or
  patched up. Clean stored data is left byte-unchanged. Neither surface gains a new upload affordance.

- fc7fcf1: **Every player-facing and internal surface that could still express the five removed keystones is
  gone.** `@bombfarm/domain` stopped modelling Abisso, Glass Cannon and Tempo Dobrado (MP5 F2); this
  change removes the last ways a player or a maintainer could still see, toggle, persist or key on
  them.

  **Removed controls (`@bombfarm/web`, rendered Account panel, both `pt` and `en`):**

  - The three `Switch` toggles — **Abisso**, **Glass Cannon**, **Tempo Dobrado** — and their On/Off
    status readouts. The Skill Tree subsection is now six read-only `<output>` rows with no input,
    button or switch/checkbox role anywhere inside it.
  - The three conditional import-preview rows in the account-import summary.
  - The advice column's forwarding of the two keystone-only fields into the breakdown model.

  **Removed i18n keys, EN and PT-BR (12 keys × 2 languages):** `treeGlassCannon`,
  `treeGlassCannonHint`, `treeAbisso`, `treeAbissoHint`, `treeTempoDobrado`,
  `treeTempoDobradoHint`, `keystoneOn`/`keystoneOff` (PT `Sim`/`Não`), `importKeystoneOn` (PT
  `Ativo`), `bdNoteGlassCannon`, `bdNoteTempoDobrado`, `bdTermAbisso`. Surviving prose in both
  languages (account hints, the damage formula's `× abisso` factor, and the planner's explain-section
  text) no longer names any of the three mechanics.

  **Removed `TreeState` fields (`@bombfarm/web`):** `glassCannon`, `tempoDobrado`, `abisso`,
  `abissoBase`, `critDmgMult` — gone from the type, `DEFAULT_TREE`, every selector, the store's
  setters (`setTreeGlassCannon`, `setTreeTempoDobrado`, `setTreeAbisso`) and the team-plan input
  builder. A stored account written before this change still loads; the dead fields are discarded on
  normalize, not fatal.

  **Removed `@bombfarm/ui` exports:** `accountKeystoneControlClass` and
  `accountKeystoneStatusClass` (`panel-field.recipe.ts`), plus the two `[&_label_[data-keystone-control]]`
  arbitrary variants inside `stackFieldsClass`. The Storybook `switch.stories.tsx` stories keep their
  ids and count (3 → 3), re-labelled and re-skinned onto a surviving row.

  **`@bombfarm/desktop` (internal, no user-facing change):** `CHANGE_KEY_INPUTS` and
  `sharedChangeKey` no longer key on the four dead tree paths, and `account-model.ts` no longer maps
  the five fields into the shared account shape.

- Updated dependencies [1fa3def]
- Updated dependencies [f0bf7f4]
- Updated dependencies [e78122a]
- Updated dependencies [96d496a]
- Updated dependencies [a0a126b]
- Updated dependencies [fc7fcf1]
- Updated dependencies [453ed05]
- Updated dependencies [fc7fcf1]
- Updated dependencies [829228c]
  - @bombfarm/contracts@0.3.0
  - @bombfarm/domain@0.5.0
  - @bombfarm/game-api@0.2.0
  - @bombfarm/ui@0.3.0
  - @bombfarm/game-data@0.0.3

## 0.2.0

### Minor Changes

- 84c8c15: Add per-section account persistence so the desktop remembers an account across restarts.

  `@bombfarm/contracts` gains the stored-account serving contract: `StoredSectionFidelity` (a
  narrowed union that structurally cannot represent `resolved`), `StoredAccountFidelity`,
  `AccountStoreStatus`, `AccountStoreReason`, `RestoredAccount` (`gameRunning` is the literal
  `false`), and `AccountView` — plus a new `account:get` IPC channel returning `AccountView`.

  `@bombfarm/desktop`'s `Storage` wrapper gains a real per-section SQLite store
  (`apps/desktop/src/main/storage/**`): each of the five account sections (`account`, `heroes`,
  `skills`, `casa`, `items`) persists independently with its own `capturedAt`, so a poll that
  resolves the roster but misses skills keeps the previous skills row untouched rather than
  blanking it. Writes run in one transaction per poll and only ever touch sections a payload
  marks `resolved`, so a partial read can never blank stored data. When the desktop starts with
  the game closed, the account it shows is read-only, honestly stamped with its capture time, and
  `gameRunning` is explicit — no code path can serve a stored section as `resolved`, enforced by
  the type (a compile error), the schema (no status column — status is derived from row
  presence), and a source guard.

  A pre-existing `last-snapshot.json` from an earlier install is imported once, then the file is
  never written again; the desktop's previous JSON-file persistence mechanism (`SnapshotStore`)
  is removed along with a bug it carried — a cold boot with the game closed no longer reports the
  previous session's `connected` status read from disk.

  No web planner behaviour changes.

- e55ebda: Add a consented, read-only reader for the account state the game's own server holds — roster,
  skills, casa, bag, gold and phase — replacing the plan for a memory-assembled account after a
  live calibration capture proved the game only loads that data on demand (a silently absent
  skill tree is not an empty tree; it is wrong advice computed from a zeroed one).

  **This is the first release in which the desktop contacts a network host on the player's
  behalf.** It happens only after the player explicitly accepts a first-run modal that states
  plainly what is used (the session token the game itself already saves locally), where it goes
  (`api.bombfarm.net` and nowhere else), that access is read-only, that no disruptive action is
  ever taken without approval, and that the decision is reversible at any time. Declining leaves
  the app fully usable on whatever account data was already stored.

  `@bombfarm/game-api` is a new package: a GET-only client (no write route exists anywhere in it,
  enforced by a guard test) built from a consent reducer, a token type that cannot be printed,
  serialised, or logged by any call site that forgets to redact it, a single-flight paced request
  path with a bounded cooldown backoff, the five account routes with committed response
  fingerprints that catch a game update before it is silently misread, and an assembler that
  turns one cycle's reads into a per-section fidelity report with no carry-over of its own.

  `@bombfarm/contracts` gains a fourth `SectionStatus`, `degraded` — the source answered, but its
  shape is no longer one this app parses safely, so it carries no body rather than a plausible
  wrong number — plus the `consent:get`/`accept`/`decline`/`revoke` IPC channels and the
  `consent:changed`/`account:changed` events.

  `@bombfarm/desktop` gains the platform edge that makes this real: the one `https` socket, the
  gated read of the token file, consent persisted alongside the existing account database, and
  the cycle that ties them to the account store's own last-known-good carry-over — a route that
  fails this cycle is served back from storage, honestly labelled stale, never silently dropped.
  Memory continues to serve combat telemetry only; the account state it can no longer be trusted
  to assemble is not looked to as a fallback, in this feature or ever.

  `@bombfarm/domain` gains a test file and committed fixtures proving the assembled payload
  parses through its unmodified parser (`packages/domain/src` is untouched) — a `patch`, since
  `changeset status` treats any change under a package's directory as package-changed regardless
  of whether it touched `src` or `tests`, and `updateInternalDependencies: patch` would apply this
  bump automatically the moment its `@bombfarm/contracts` dependency moves regardless.

  No web planner behaviour changes.

### Patch Changes

- Updated dependencies [84c8c15]
- Updated dependencies [66d38d0]
- Updated dependencies [e55ebda]
  - @bombfarm/contracts@0.2.0
  - @bombfarm/game-api@0.1.0
  - @bombfarm/game-data@0.0.2

## 0.1.2

### Patch Changes

- dc82f15: `AppShell` grows into a sidebar nav + content area + status bar (data-driven `items`, controlled `activeId`/`onNavigate`; an empty/omitted `items` renders no nav rail). Adds `StatusChip`, the single implementation of the game-connection states (connected / not running / stale, with an optional age label), and `EmptyState` for "no game / no items / no filter matches" placeholders. The sidebar collapses to icons-only below the `compact` breakpoint; collapsed labels stay in the accessibility tree.

  The desktop renderer adopts all three: its hand-rolled `formatStatus`/`statusClass` helpers and hardcoded `emerald`/`amber`/`--bf-*` classes are gone in favor of `StatusChip` and token-based chrome, and the "preload bridge unavailable" / "no snapshot yet" states now render through `EmptyState`.

- Updated dependencies [dc82f15]
- Updated dependencies [dc82f15]
- Updated dependencies [dc82f15]
- Updated dependencies [dc82f15]
  - @bombfarm/ui@0.2.0

## 0.1.1

### Patch Changes

- Updated dependencies [d2116e5]
- Updated dependencies [6ca8b4a]
  - @bombfarm/ui@0.1.0

## 0.1.0

### Minor Changes

- 3f8d4cb: Show the app version in the web footer and desktop shell, and carry version over the typed app-environment IPC boundary. Lands the changesets release rail (release PR, nightly, dormant prod).

### Patch Changes

- b930794: Allow Windows packaging to spawn pnpm.cmd under Node 20+ (shell: true for CVE-2024-27980).
- Updated dependencies [3f8d4cb]
  - @bombfarm/contracts@0.1.0
  - @bombfarm/game-data@0.0.1

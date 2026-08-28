# @bombfarm/contracts

## 0.4.0

### Minor Changes

- fae49fb: The first-run consent dialog now discloses that the desktop companion attaches to the running
  Bomb Farm client to read the traffic it is already exchanging with the game's server, in addition
  to calling the game's own API with the session token the game already saves on your machine. The
  dialog also explains that this attaching technique is what can cause antivirus software to flag or
  quarantine the companion, and that the warning is about the technique, not a virus.

  Because the disclosure changed, everyone who already accepted the previous version is asked to
  review and accept the new one before the companion reads their account again.

  A new Account access control in Settings makes the disclosure's "reversible" promise real: turning
  access off stops the reads and detaches from the game client immediately, and turning it back on
  re-shows the same disclosure so the player reviews it again before allowing.

  The dialog is now shown in Portuguese as well as English, and the recorded decision remembers which
  language it was shown in, so an agreement is always traceable to the exact wording the player read.

  The desktop app no longer runs without this permission. Declining now shows a screen explaining
  that the companion has nothing to show without account access, with a control to read the
  disclosure again and accept. That screen carries its own language switch, so a player whose
  computer language does not match the language they read can still understand what they are
  agreeing to.

- dec4425: The Live screen now shows who is on the field, not only what they are called. A hero row carries
  a rarity-tinted avatar tile, the rank letter, the name, its stars and its rarity — the same
  identity the Planning roster shows.

  Rarity and stars reach it the way the name and rank already did: joined from the roster by id in
  the main process, where the entry carrying them was already being read. They follow the same
  absence rule as the fields beside them, so a hero the roster has not caught up with renders as
  its id against a neutral frame rather than with anything invented to fill the gap, and a grade
  still never appears without the name it arrived with.

  The portrait itself is the same for every hero. The in-game skin index is not carried on this
  data path, so rarity is what distinguishes one tile from another today.

- 1d9d79f: The desktop app now opens on a Live screen showing what your account is doing right now, instead
  of the Planning screen you had to navigate away from to see anything current.

  The screen shows four hero lists — on field, recovering, queued, benched — the active house (its
  level, slots, cycle time, and how many daily rescues are left), and field occupancy as plain
  information (heroes on field against the field size, with no warning styling and no implication
  that an open slot is a mistake). Every list renders even when it has nothing in it, with a line
  explaining why, because a hidden empty list and a missing section would look identical and
  "nobody is currently recovering" is real information worth showing. A hero whose name has not
  synced yet still renders, by its id.

  A status line at the top says whether the screen is reading live frames from the game or falling
  back to the slower authenticated read, and if it is not live, says why in plain language — the
  game is open but idle, the app has not connected yet this session, security software is the likely
  reason the connection failed, and so on. The one case with a real fix (you have not allowed the
  app to read your account) offers a control to review that permission again; every other case is
  already retried automatically every few seconds, so the screen does not offer a button that would
  not do anything.

  Three honesty properties carry through the whole screen. A value the game never sent renders as a
  visible gap, never as a substituted zero, dash, or "Unknown" — and a value that is genuinely zero
  still renders as zero, so the two read differently on screen. A hero's remaining field time is
  either measured from observed frames or estimated from stats, and an estimate is marked with a
  muted, non-layout-shifting treatment (plus a screen-reader-only label) so it can never be mistaken
  for a measurement, even as the game's own reporting flips between the two while you watch. A
  recovery countdown that has stopped advancing is shown as paused rather than left to look like it
  is still ticking down on its own.

  Every string on the new screen ships in Brazilian Portuguese as well as English, matching the rest
  of the app.

  The developer-only Diagnostics tab and its raw-payload dump are removed, along with the two
  internal channels that fed them. This is a deliberate loss with no replacement in this change — the
  Settings screen's own "save a bug report file" control is a different feature and is unaffected.

  Field occupancy now counts a hero the live frames show on the field even before the slower account
  read has caught up to it, so "slots in use" never reads lower than what is genuinely deployed. A
  hero walking off the field is reported with its own calm, self-resolving line rather than the
  message reserved for data the app genuinely could not read.

  The screen also keeps up with the game far better than a polling app could. While you play, the
  game client is constantly fetching your own account state from its server, and the companion is
  already reading that same traffic — so it now recognises those responses and updates from them
  directly, instead of asking the server again for something it just watched arrive. Benching a
  hero, or sending one out to the field, shows up in the companion without waiting out a refresh
  cycle, and without adding a single request of its own.

  This is opportunistic by nature: it only learns what your game actually asks for, so the
  companion's own paced reads remain in place for everything else — before the game has fetched a
  route for the first time, and whenever you leave the app open without playing. A response the
  companion cannot confidently recognise, which is what a game update looks like from here, is
  discarded rather than guessed at, and the app falls back to reading for itself.

  A hero's remaining field time now counts steadily down instead of leaping up and down as heroes
  rotate on and off the field. When the app cannot measure a hero's drain directly it estimates it —
  but that estimate was never given the hero's own drain-reduction data, so it assumed no reduction
  at all and ran up to 40% out. It now uses each hero's real abilities and the field's actual aura.
  The app also stops discarding a hero's measurements every time some unrelated hero steps on or off
  the field, and only does so when that hero's own drain conditions genuinely change. Where no rate
  can be measured or estimated at all, no countdown is shown rather than one built from a number
  known to be wrong.

### Patch Changes

- 7d3a951: Live frames decode into the fields they were always meant to fill, and the desktop log stops
  repeating itself

  The live combat decoder read field names the game does not send. Measured against a real captured
  session: across 381 frames it produced **zero** hero energy values, zero room-HP readings, and 336
  hit entries with no damage on any of them — the wire sends `e`, `room_hp` and `d` where the decoder
  read `energy`, `roomHp` and `amount`, and `gold` arrives as a string of digits that was being passed
  straight into a number-typed field. Nothing errored, because frames decoded fine and carried the
  expected message type; the live panel simply had nothing to show. The synthetic test fixture was
  hand-written against the same assumed names, so it agreed with the decoder and both disagreed with
  the game.

  The wire vocabulary now lives in one lexicon beside the existing rotation one, so abbreviations are
  translated to names that say what the value is — `heroes[].e` is an energy fraction, `heroes[].w` a
  move speed, `hits[].d` damage — and the generated wire glossary covers both routes. Money is
  coerced from its wire string and a malformed value is dropped rather than becoming `NaN`. A capture
  from a real session is committed as a fixture, so this class of drift fails a test instead of
  emptying a panel.

  The shared desktop log gained two guarantees with no bypass: every record is redacted before it
  reaches the transport, and repeated records collapse to one line plus an exact count. At ten frames
  a second a single undeduplicated field-drop was 36,000 identical lines an hour; it is now one line
  and a count. The session token can be scrubbed from any log record without the token type ever
  handing its raw value to a caller. Rotation field drops that used to be discarded are now reported
  once per field rather than once per hero affected.

  Supporting this: a bounded in-memory ring of recent frames, dumped scrubbed on a decode failure, and
  a dev-flavor-only raw capture behind an explicit flag. Both write local files beside the user data;
  neither transmits anything. A decode failure no longer discards the good frames that shared a
  network read with the corrupt one — previously all of them were lost, including the ones the crash
  dump existed to preserve.

  Settings gained a Diagnostics section with a "Save a bug report file" button, so a player can
  trigger the same scrubbed dump on demand instead of only after a decode failure. A rate-limited or
  failed write is reported as such, never as a silent success.

## 0.3.4

### Patch Changes

- a844381: Remove the process-memory reading path from the desktop app. The diagnostics snapshot panel now
  sources its gold/phase/wave reading from the in-run live data source instead of scanning the
  game's process memory directly, and the app no longer depends on a native FFI library to read a
  running game's memory. Account data was never sourced from process memory in the first place — it
  has always come from the authenticated periodic sync — so this has no effect on account, hero,
  skill, casa, or inventory data.

## 0.3.3

### Patch Changes

- 8692c92: Add the in-run live data source, alongside the existing periodic account sync

  Groundwork for reading a running game session's live combat stream, so field and recovery
  countdowns can eventually be built from real, observed energy drain rather than only the modelled
  rate. Countdowns now carry where their number came from, and a number derived from the modelled
  rate is never presented as an observed measurement.

  The app reports whether it is reading live data and, when it is not, distinguishes a gap it could
  act on — never attached, permission not granted, the read went quiet — from one it cannot, such as
  the game being closed or idle. Recovery countdowns advance only while the game world is actually
  advancing, so they freeze rather than counting down through time that never happened. Revoking
  permission for the live read takes effect immediately, tearing the attachment down before the
  revoke is recorded.

  The live read itself is not enabled in this release: no instrumentation runtime ships yet, so the
  app runs in its no-live-data mode, serving the periodic account sync and labelling every countdown
  as modelled. That path is a supported state, not a failure.

## 0.3.2

### Patch Changes

- b1e2591: Stop a harmless added field from hiding DPS, next-point ranking and reset advice

  A game update that only adds a field this app doesn't read used to be treated exactly like one
  that removes a field it does read: either kind of shape drift made the desktop withhold DPS,
  next-point ranking and reset advice for every hero, even though nothing the planner actually
  needed was missing. Now those two cases are told apart. A drift that only adds fields is
  harmless — nothing read was lost, so advice keeps rendering as normal, just flagged as drifted.
  A drift that drops a field this app reads still falls back to the last good reading instead of
  computing from an incomplete body (and guessing at the missing value), exactly as it did before
  shape drift got its own status.

- 635abe3: Add rotation status classification: field, recovering, queued, and benched

  `@bombfarm/domain` now exposes `classifyRotation`, which sorts a normalized `/rotation` snapshot's
  heroes into four lists — on the field, recovering at the house, queued for a house slot, and
  benched — plus an occupancy count and the house panel's read-only figures (active house level,
  slots, cycle time, rescues). Classification keys off each hero's own activity, never off whether
  the game currently has them parked at the house: a benched hero and a queued one can both sit at
  the house at the same time, so that flag alone cannot tell them apart. Each recovering hero also
  carries its own remaining recovery time, derived from the house's cycle length and how full its
  energy is.

  The rotation vocabulary also gains the fourth hero state the game reports — fully recovered and
  waiting for a field slot. It was previously unrecognised, which cost a hero its activity; it now
  reads as its own state and is listed alongside the heroes queued for a house slot.

- b1e2591: Add a normalized, English-named `/rotation` snapshot, replacing raw wire fields at the boundary

  `/rotation`'s wire body mixes Portuguese and English keys (a house object keyed by a Portuguese
  name, energy fields with Portuguese names, alongside plain English fields like `cycle_secs` and
  `battle_allowed`). `@bombfarm/game-api` now exposes `normalizeRotation(body, roster)`, translating
  that wire body plus a `/roster` heroes list into an English-named `RotationSnapshot` (new types in
  `@bombfarm/contracts`): per-hero energy, activity, and field/house status, joined with the roster's
  name and grade where a match exists. Every field is validated and dropped independently on failure
  — a bad or missing field never takes a sibling, a hero, or the whole section down with it — and
  each drop is reported with the wire field it came from and why.

  This is additive: nothing existing reads from `normalizeRotation` yet, so no shipped behavior
  changes. A generated reference table of the wire-to-domain vocabulary lives at
  `docs/wire-vocabulary.md`, and a guard confines Portuguese wire vocabulary to the one lexicon
  module that documents it, everywhere else in this new boundary.

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

## 0.3.1

### Patch Changes

- 06bcc05: Removes `InventoryItem.iconUrl` and the parser that built it.

  The inventory parser composed a live wiki asset URL from the item's _instance_ level and handed it
  back on every parsed item. Nothing rendered that field — item art comes from the bundled assets via
  `itemIconSrc`, which keys off the set's native level — so the URL was both unused and wrong. Item
  art must never be sourced from the wire, so the builder and the contract field are gone rather than
  corrected.

  No consumer migration: the field had no readers.

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

- 66d38d0: Add a source-neutral account payload contract and route save-file parsing through it.

  `@bombfarm/contracts` gains `AccountPayload` plus its per-section fidelity types
  (`AccountSection`, `SectionStatus`, `SectionFidelity`, `AccountFidelity`, `AccountFidelityGrade`,
  `AccountFidelityReport`) — the typed shape both the web upload path and the future desktop
  live-memory reader will target. It declares no `export_version` / `generated_at`; those
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

## 0.1.0

### Minor Changes

- 3f8d4cb: Show the app version in the web footer and desktop shell, and carry version over the typed app-environment IPC boundary. Lands the changesets release rail (release PR, nightly, dormant prod).

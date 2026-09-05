# @bombfarm/game-api

## 0.4.0

### Minor Changes

- 076fc40: Give the app the ability to make one kind of write — a forge roll — behind a switch that is off.

  **The companion can now send one thing.** Until now it was read-only by construction, and the
  guards that prove it stayed green on every change. It can now make exactly two calls of its own,
  the two the game's own forge screen makes when you roll an item: `/item/forge` and
  `/item/forge_to_safe`. Nothing else in it can write. The guards still prove that: `POST` is
  allowed in one file, that file names those two paths and no other, and every other file is held
  to the same no-write rule as before. A write also has to come from a session that was granted
  consent, and from a write capability that only exists while the switch below is on — both are
  checked at runtime, not only by type. Writes share the reads' pacing gate, so a cooldown on a roll
  backs off the account reads too, and no two calls of any kind can interleave past each other.

  **The disclosure changed, so everyone will be asked again.** The first-run text used to say
  "never writes". It now says what the app can send, that it can only do so from the Forge tab,
  only after you turn the switch on, and only after you confirm each run. Every install sees the
  new text at its next launch and has to allow it again.

  **The switch is off until you turn it on.** Settings has a new Forge section with one control,
  "Let Forge spend gold". Off, the Forge tab plans climbs and never rolls. On, the Forge button can
  spend gold on your account, one confirmed run at a time. An existing install migrates with it off.

  **The tab itself comes in a later change.** This is the boundary work: the capability, the
  disclosure, the switch. Nothing in the app calls the new write yet.

### Patch Changes

- Updated dependencies [a326087]
- Updated dependencies [2ab64c9]
- Updated dependencies [076fc40]
  - @bombfarm/domain@0.12.0
  - @bombfarm/contracts@0.7.0

## 0.3.7

### Patch Changes

- 1eda18d: Stop the desktop app from silently giving up on reading your account, and say how old the Farm
  board's numbers really are.

  **A single rejected read no longer freezes the app until you restart it.** When the game's servers
  turned down one request, the app stopped asking — permanently. Everything carried on looking
  normal: the Farm board kept its numbers, the Refresh button kept working, nothing said anything
  was wrong. But the account behind those numbers had stopped moving, and the only way out was
  quitting and reopening the app. One installation sat like that for over fifteen hours, and the
  credentials had been fine the whole time — reopening the app proved it by working immediately with
  the very same session. The app now waits and tries again, backing off from a minute up to fifteen
  if the rejections keep coming, so a passing refusal costs one skipped read instead of the rest of
  the session.

  **The line under the Farm board's Refresh button now dates your account, not the calculation.**
  It used to time how long ago the board was worked out, which is a different thing and only looks
  the same while the app is reading the game normally. Change a setting on the board while the app
  has lost contact and the line reset itself to "just now" over numbers that had not moved in hours.
  It reports the age of the account read itself now — the oldest part of it, so it never sounds
  fresher than the stalest thing under it — and no amount of recalculating can make that read look
  newer than it is.

- Updated dependencies [006f970]
- Updated dependencies [37fd673]
- Updated dependencies [a8f352f]
- Updated dependencies [f534b9e]
  - @bombfarm/domain@0.11.0

## 0.3.6

### Patch Changes

- Updated dependencies [4b6d4ba]
- Updated dependencies [4b6d4ba]
  - @bombfarm/contracts@0.6.2
  - @bombfarm/domain@0.10.2

## 0.3.5

### Patch Changes

- Updated dependencies [b02478e]
- Updated dependencies [090f1ce]
- Updated dependencies [972e2d1]
  - @bombfarm/contracts@0.6.1
  - @bombfarm/domain@0.10.1

## 0.3.4

### Patch Changes

- a33317f: Stop the Live tab losing every hero's name and portrait after a long session.

  Left running overnight, the hero list would eventually redraw as raw account ids under the default
  portrait, with no rank letter, and stay that way until the game was restarted. Three separate
  things had to be true for that, and all three are fixed here.

  The identity a hero row shows — name, rank, rarity, stars, portrait — is not in the rotation feed
  that drives the list. It is joined onto it from the roster, which is read on its own request, and
  the app holds the last roster it read so that the live stream (which carries no roster at all) has
  something to join against. That held roster was being replaced by whatever the newest cycle
  carried, including nothing: the five requests behind one cycle fail independently, and the roster
  is read _before_ the rotation, so a cycle that lost only the roster still committed a rotation
  body and blanked the join on its way past. Every later frame then re-joined against the emptied
  roster, so one lost request cost every name until some later cycle happened to read a roster
  again. The held roster is now kept unless a cycle actually read one, which is the same stickiness
  the account-wide multipliers beside it already had.

  Nothing reported any of this while it happened. A join that named nobody was silent — every
  identity field is optional, so the result was a structurally valid, entirely nameless snapshot —
  and a request that failed was silent too, so a cycle that lost one of its five and committed the
  other four logged exactly what a clean cycle logged. A failed section is now named in the log with
  its reason, and a join that resolved no identity at all is reported once for the join rather than
  once per hero.

  Underneath both: the roster had no stored last-known-good to fall back on. Sections were only
  written to storage when they arrived perfectly intact, so a game update that merely _adds_ a field
  the app does not know yet — as one recently did to heroes and inventory items — quietly stopped
  those two sections from ever being stored again. They still displayed, because a body that lost
  nothing is served as it arrives; but nothing was kept, so the moment a live read failed there was
  no older copy behind it, and with the game closed there was nothing to show at all. Storage now
  keeps a section whose body lost no field, which is the same test already used to decide whether
  that body is fit to display — a section good enough to show is a section good enough to keep.

- Updated dependencies [af7bd8c]
  - @bombfarm/domain@0.10.0

## 0.3.3

### Patch Changes

- Updated dependencies [3eb7026]
- Updated dependencies [c94648a]
- Updated dependencies [3233351]
  - @bombfarm/contracts@0.6.0
  - @bombfarm/domain@0.9.1

## 0.3.2

### Patch Changes

- b7d837a: Fix every authenticated account read failing. The game's own server moved its API to a new
  address and withdrew the old one from DNS entirely, so every request the app made was failing
  outright. The app now targets the new address, and the first-run consent screen's privacy
  disclosure — which names the address your session token is sent to — has been corrected to match;
  what it promises (your token goes only to the game's own server, never anywhere else) is unchanged.

  **You will be asked for consent again.** A grant records which disclosure you agreed to, and this
  one names a different address than the one you saw. Consent given for the old wording is not
  treated as consent for the new, so the app asks once more rather than assuming. Account reads stay
  paused until you answer.

- Updated dependencies [c3dd984]
- Updated dependencies [48ae346]
- Updated dependencies [48ae346]
- Updated dependencies [b7d837a]
- Updated dependencies [b7d837a]
- Updated dependencies [8ba7408]
- Updated dependencies [19197cc]
- Updated dependencies [48ae346]
- Updated dependencies [48ae346]
  - @bombfarm/contracts@0.5.0
  - @bombfarm/domain@0.9.0

## 0.3.1

### Patch Changes

- Updated dependencies [74e3119]
  - @bombfarm/domain@0.8.1

## 0.3.0

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

- Updated dependencies [fae49fb]
- Updated dependencies [0e769ac]
- Updated dependencies [e637f31]
- Updated dependencies [1d9d79f]
- Updated dependencies [659fcc5]
- Updated dependencies [0e769ac]
- Updated dependencies [681643e]
- Updated dependencies [d7c1565]
- Updated dependencies [d7c1565]
- Updated dependencies [dec4425]
- Updated dependencies [5a4620b]
- Updated dependencies [7d3a951]
- Updated dependencies [1d9d79f]
- Updated dependencies [82f93dd]
- Updated dependencies [550b376]
- Updated dependencies [1d9d79f]
- Updated dependencies [dec4425]
- Updated dependencies [d5a412c]
  - @bombfarm/contracts@0.4.0
  - @bombfarm/domain@0.8.0

## 0.2.5

### Patch Changes

- Updated dependencies [8cb9912]
  - @bombfarm/domain@0.7.0

## 0.2.4

### Patch Changes

- Updated dependencies [d1dce84]
- Updated dependencies [a844381]
  - @bombfarm/domain@0.6.3
  - @bombfarm/contracts@0.3.4

## 0.2.3

### Patch Changes

- 587ed60: Prove the full-and-waiting rotation state against a real capture

  The fourth hero state — fully recovered and waiting for a field slot — was
  implemented against its documented shape but had never been seen in a committed
  body. A capture now carries it, along with the other three states, and the
  classification is asserted against that rather than against constructed heroes.

  The capture confirms the shape the classification was built on: a hero in that
  state is out of the house and off the field at once, which is the pairing that
  makes it impossible to identify from either flag alone.

- Updated dependencies [8692c92]
- Updated dependencies [587ed60]
- Updated dependencies [dbb38f1]
- Updated dependencies [da61de5]
  - @bombfarm/contracts@0.3.3
  - @bombfarm/domain@0.6.2

## 0.2.2

### Patch Changes

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

- Updated dependencies [7772ae0]
- Updated dependencies [b1e2591]
- Updated dependencies [b1e2591]
- Updated dependencies [f2d6231]
- Updated dependencies [635abe3]
- Updated dependencies [b1e2591]
- Updated dependencies [b1e2591]
  - @bombfarm/domain@0.6.1
  - @bombfarm/contracts@0.3.2

## 0.2.1

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
- Updated dependencies [590a5e9]
- Updated dependencies [4fcaa1a]
- Updated dependencies [560f83d]
  - @bombfarm/domain@0.6.0
  - @bombfarm/contracts@0.3.1

## 0.2.0

### Minor Changes

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

### Patch Changes

- Updated dependencies [1fa3def]
- Updated dependencies [f0bf7f4]
- Updated dependencies [e78122a]
- Updated dependencies [96d496a]
- Updated dependencies [a0a126b]
- Updated dependencies [fc7fcf1]
- Updated dependencies [453ed05]
- Updated dependencies [829228c]
  - @bombfarm/contracts@0.3.0
  - @bombfarm/domain@0.5.0

## 0.1.0

### Minor Changes

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

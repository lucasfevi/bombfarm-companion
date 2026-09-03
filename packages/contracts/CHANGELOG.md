# @bombfarm/contracts

## 0.6.2

### Patch Changes

- 4b6d4ba: Open a compact second Live window from the **Open mini** button in the app header or the tray
  **Mini** entry, once you have granted account access. Choose which panels appear, stack them or
  put them side by side from the gear menu, and pin the mini window always-on-top from Settings. The
  mini remembers its size, position and panel choices across restarts on the same display.

  Its hero rows show the name, rank and level, and mark whether each hero is on the field, resting,
  idle or benched. The window appears as soon as you click, showing a placeholder while it starts
  rather than waiting with nothing on screen.

## 0.6.1

### Patch Changes

- b02478e: Fix Settings → Updates claiming "Updates are off in this build" on installed Beta and stable
  builds. Main answers the renderer's one status read before it has finished building the update
  service, and that pre-service answer said `disabled` — a claim about the build rather than about
  readiness, and one that greys out the check button that would otherwise disprove it. It now
  reports the flavor's real capability, and the settled status is pushed once the service exists.

  Add an update indicator to the desktop footer, left of the version. It appears when an update is
  found, stays through the download, and ends on "Restart to update"; clicking it opens Settings →
  Updates, where the controls already live.

## 0.6.0

### Minor Changes

- 3eb7026: Fill out the Live tab's earnings panel, which showed six numbers and then a large empty space
  below them wherever the map panel beside it ran taller.

  Two things now sit in that space. A trend line covers the same ten minutes the headline gold rate
  averages, so a run that is picking up or falling away is visible rather than something you infer
  from two figures that disagree — a stretch the stream never covered breaks the line instead of
  drawing it as a collapse to no income. Beneath it, three measured figures: gold per prop, props
  per minute, and the session's prop count, all counted from what actually dropped. Gold per prop is
  printed against the map panel's own estimate for the map being played, so a map paying less than
  it should now says so.

  The trend line ships as a `Sparkline` primitive in the design system rather than as a one-off:
  it takes any series of readings, stretches to whatever width its container has, and takes its
  colour from the text colour around it.

- 3233351: Ship the desktop app on a stable channel, and point the download page at it.

  Merging a desktop version bump to `main` now publishes a public GitHub Release. It always looked
  as though it did: the workflow packaged an installer, named itself after production, and logged a
  successful run. What it actually did was gate the publish step on a repository variable nobody had
  ever set, upload the installer as a CI artifact that expired after a day, and publish nothing —
  165 times. The gate is gone. Whether to ship is decided by whether you merge the release PR, which
  is the control that was always real.

  The download page serves that stable build, and falls back to the newest beta when no stable build
  exists — which was the case for the whole life of the page until now, and would be the case again
  if stable publishing broke. The fallback is never silent: the chip beside the download button and
  the line under it name the channel the page actually resolved, and the channel cards mark whichever
  one is being served. Recognising a stable installer takes a little care, because it is the one
  build electron-builder names without a channel word in it: `bombfarm-companion-0.7.0-setup.exe`
  against beta's `bombfarm-companion-beta-0.7.0-beta.163-setup.exe`.

  The nightly channel is withdrawn — the flavor, its packaging script, its scheduled workflow, its
  release retention, and the card on the download page that promised builds "every night". It had
  published no release in the life of the project and its schedule had been switched off to save CI
  minutes, so nothing is installed on it and no update path breaks. `BFC_FLAVOR` now takes `dev`,
  `beta` or `prod`, and rejects `nightly` rather than quietly accepting a flavor that no longer
  builds.

### Patch Changes

- c94648a: Stop the Live tab redrawing itself four times a second to show the same numbers.

  Per-hero energy rides the fast channel as a raw fraction, and it moves on every frame: four
  consecutive readings off the wire were 0.28425…, 0.28389…, 0.28377…, 0.28365…. The bar is one
  percent wide per point and the reading beside it has no decimals, so all four are the same
  picture — but every one of them counted as a change, so the main process emitted, the store
  republished, and every hero row re-rendered, continuously, for as long as the screen was open.

  Both sides now ask whether the _displayed_ percentage moved, through one shared
  `energyDisplayPercent` in the contract rather than two comparisons that could drift apart. Nothing
  on screen changes: the bar and the reading are drawn from that same whole percent already, and
  their agreement is asserted on the running app.

  Three things underneath had to change for that to bite, each a defeat of memoisation on its own:

  - The store replaced every slice of a fast update with whatever arrived, so a tick that moved only
    the gold balance still handed over a brand-new countdown array saying exactly what the old one
    said. Each slice now keeps the reading it already holds when the new one agrees.
  - A hero row was handed a hero merged with a fresh energy figure, which compares by identity. The
    reading now travels beside the hero as a number, so one hero's energy can move without
    re-rendering the twelve rows around it.
  - The earnings panel rebuilt two Base UI tooltips — provider, root, trigger, portal, positioner,
    popup — four times a second to draw two words that depend only on the language.

## 0.5.0

### Minor Changes

- c3dd984: Update the desktop app from its own release channel, from a new Settings section.

  Installed builds now check for a new version shortly after launch and every six hours they stay
  open, and Settings gains an Updates section that reports what they found: the installed version
  and its channel, whether one is available, download progress, and a restart-and-install action
  once it is ready. A check button covers the time in between.

  Nothing downloads without being asked. Finding a version announces it and stops there, so a
  player on a metered connection chooses when to spend the bandwidth. The download is
  resumable-by-retry rather than resumable: a failed one starts over.

  Each installed flavor follows its own channel — Nightly, Beta, and stable never offer each other's
  builds. A local development build has no channel and no installer to replace, so the section says
  so plainly instead of showing a control that would do nothing.

  Failures arrive as one of four reasons — unreachable server, rate limit, no published release,
  or unknown — each translated in both languages, rather than the updater's own English text
  reaching the screen.

  Settings rows can now hold a read-only value in their control column (`data-settings-value`),
  alongside the equivalents the Account and math-check stacks already had.

- 48ae346: Price items in the desktop app from the published market snapshot, and let a single item be
  re-quoted live.

  The main process reads the published snapshot with a conditional request and caches the accepted
  body beside the flavor's other user data, so a cold start with no network still prices everything
  the last good run knew about. A 304 costs no body and changes nothing; a failed check leaves the
  snapshot in hand exactly where it was rather than blanking a screen that had prices on it.

  The desktop app can additionally re-quote one item on demand, which the web planner cannot: Steam
  sends no cross-origin header, and only the per-item endpoint honours a currency. Quotes are BRL,
  paced to one call at a time with a floor of several seconds between them, and a rate-limited
  answer widens an exponential backoff that the next success clears.

  That endpoint under-reports — it has answered with no price for an item carrying a live listing —
  so a refresh that comes back unquoted reports that it could not refresh and leaves the snapshot's
  own price standing. It never overwrites a real price with an absence.

### Patch Changes

- b7d837a: The live tick stream now folds gold and XP into a measured per-hour rate, entirely in the main
  process: a sequence-guarded accumulator tracks payouts against a 10-minute rolling window and the
  whole session, with a second independent check that grid-clear counts and payout counts agree. The
  result publishes on the existing live fast channel as `LiveView.earnings`, and a
  `live:resetEarnings` call lets the session figures be zeroed without disturbing the rolling window.

  This is the data layer only — no panel reads it yet, so there is nothing new on screen.

- b7d837a: The Live tab now shows an Earnings panel above the heroes panel: the current gold balance (with the
  in-game coin), gold rates for the last few minutes and the whole session, and the quieter XP
  counterparts of both — one row of figures divided by thin rules, rather than a table. Every rate
  the app has not measured yet reads as a dash, never a zero, and the session control that used to
  read "Reset session" is now an icon button with the same accessible name.

  The compact number formatter (`90200` → `90.2k`) moved from the web planner into the shared design
  system so the desktop panel renders the exact same figures the web planner does — the web planner's
  own import path is unchanged.

  With the game closed and no live tick ever arriving, the current-gold cell now falls back to the
  most recently stored account reading instead of showing a dash, with its age shown alongside it —
  the same posture the panel already took for a balance that went stale mid-session. No new request
  is made to refresh it; the displayed age simply grows while the game stays closed.

  The panel has since been redesigned again: a single bordered headline band up top carries the
  dominant gold-per-hour figure and a smaller XP-per-hour figure beside it on a shared text baseline,
  with a context line underneath stating the true coverage of the recent window and the session
  average rate, plus the reset control. Below the band, a reflowing grid of six tiles covers current
  gold, elapsed session time, and both currencies' session totals and session rates. The two session
  totals (`goldSessionTotal`/`xpSessionTotal` on `LiveEarnings`) are newly published by the live fold
  — they were already tracked internally to compute the session rates, but never reached the
  renderer before this change. Like every other figure on the panel, a total reads as a dash rather
  than a zero before the session has anything to report, and is unaffected by the unrelated
  10-minute rolling window's own eviction.

  The very first account read after launch no longer waits out the full scheduled cadence: the app
  now starts a read the moment the game is detected as running, instead of only on the next
  scheduled cycle, so the waiting state on the Live tab clears sooner when the game was already open
  at boot. That waiting state itself is also friendlier while it lasts — its sprite now renders at
  twice the size, and a small rotating line of flavour text sits beneath it whenever a read is
  genuinely in progress (never while consent is what is actually blocking), in both English and
  Portuguese, and holding still under reduced motion.

  The panel's chrome is quieter still: the visible "Earnings" title is gone (the landmark keeps the
  same name for screen readers, carried on the panel itself instead of a heading), and the reset
  control dropped its button outline and padding, now showing as a slightly larger bare icon that
  still focuses and announces itself like any other button. Every live figure — both headline rates,
  the session-average line, and all six tiles below — now sits in a box reserved for its widest
  realistic form, so a rate ticking up through the compact-number ranges no longer nudges anything
  beside it. The XP figure's old "?" control, which opened a click popover while also showing the
  browser's own native tooltip underneath it, is gone; the "xp / hr" label itself is now the trigger,
  underlined with dots, opening the same explanation on hover or keyboard focus, with no native
  tooltip left to compete with it.

  The current-gold tile's age suffix now stays hidden while a reading is under a minute old, instead
  of printing a "just now" that told the player nothing. Past that threshold it still reserves its
  own space so its arrival never nudges the balance beside it.

  Every tile's value is now right-aligned to the tile's own edge, matching the left-aligned label
  above it — previously the values sat in a fixed-width box that made them look inconsistently
  placed from tile to tile. A rate tile's unit stays glued to its digits rather than drifting to the
  tile's far edge on its own.

  The Live tab now gives the earnings panel half the page width, sitting at the top of the tab in the
  first column of a two-column area — the other column is left empty for a companion panel to land in
  later, without the earnings panel itself needing to change. Its six tiles moved from a loosely
  reflowing row onto a fixed three-column grid, giving two even rows of three instead of a stretch of
  tiles that could all land on one line on a wide window; on a narrower window the tiles settle into
  two columns instead of crowding three into too little space. The heroes panel below keeps spanning
  the full width of the tab.

  The reset icon has grown one size further, still a bare, real button with no border or background.

  Three more presentation fixes, now that the earnings panel only spans half the tab width. The
  current-gold tile's age no longer shares a line with the balance — it sits on its own reserved line
  beneath the number, hidden until the reading is genuinely stale, and the balance itself is now
  sized exactly like every other tile's value instead of reserving room for a trailing age that used
  to overflow the narrower tile. All six tiles keep the same height regardless, since every tile
  reserves that second line whether or not it ever has anything to show there.

  The headline band's context line no longer repeats the session-average rate — the dedicated session
  gold-rate tile below already says it, so the line now states only the recent window's coverage. That
  line's left edge now lines up with the gold-per-hour figure above it, and the whole band reads
  noticeably more compact with the redundant figure gone.

  In the heroes list, every hero's energy bar now starts and ends at the same horizontal position on
  every row: the hero identity block, the bar itself, the percentage reading, and the countdown
  column all sit in one fixed set of grid columns shared by every row, so two heroes at the same
  energy level draw fills of the same length instead of one looking further along than the other
  purely because its name or countdown differed in width.

  The earnings panel is restructured again, into two halves side by side split by a thin vertical
  rule. The left half is a single right-aligned stack: the coverage line, the gold-per-hour figure
  with its unit on its own line below, then the XP-per-hour figure the same way, with the XP unit
  line still carrying the hover/focus explanation it always has. The right half drops the bordered
  tiles entirely — its six figures now sit as plain label-over-value pairs, both right-aligned, laid
  out three per row across two rows (current gold, session gold rate, session gold total; elapsed,
  session XP rate, session XP total), with spacing alone doing the separating. The two session-rate
  values dropped their trailing per-hour suffix, since the label above each one already carries it;
  the two session-total labels were reworded to read unmistakably as totals rather than rates sitting
  right next to them. The current-gold reading's age now sits inline beside the balance instead of on
  its own line beneath it, still reserving its own space so its appearance never nudges the balance
  it sits next to. The left half's own width is reserved against both languages' unit strings at
  once, not just whichever is active, so the vertical rule cannot shift when the display language
  changes.

  The right half's six figures now sit on fixed-width columns instead of the fractional ones that let
  a longer Portuguese label push a column wider than its English counterpart. Every label is a single
  line now — none of the six may wrap onto a second line any more, so the columns can stay this
  narrow in both languages without one clipping or nudging its neighbours. The current-gold reading's
  age moved back off the value line and onto its own third line beneath it, and every one of the six
  figures — not only current gold — now reserves that same third line, so both rows of the grid stay
  exactly as tall whether or not an age is showing anywhere in them. The gold- and XP-rate labels
  dropped "session" (the grid's own rows and columns already say as much) and the two total labels
  lost "da sessão"/their trailing repeat of it, so all six fit their fixed column comfortably in both
  languages.

  The left half's own vertical rule could still drift: its column had no width of its own, so a
  compact gold or XP figure switching between digit counts resized the column and slid the rule (and
  the whole six-figure grid beside it) sideways. That column is now a single fixed width, sized from
  the widest of its own possible contents rather than letting its children set it, so neither a
  changing figure nor a language switch can move it again. With the column itself now fixed, the
  per-line width reservations the coverage line and the two unit lines used to carry (each holding
  its own longest form in either language) no longer do anything the column doesn't already cover,
  so they are gone — those lines are now plain right-aligned text.

  The headline gold-per-hour figure was still overflowing its own column at its widest realistic
  size, because the column's declared width already counts the padding and border that come out of
  it, leaving less room for the figure than it needed. The figure now renders a size smaller, and the
  column is sized to fit its true widest form — this also frees up room on the page, so the earnings
  panel's half-width layout now starts one column narrower than before.

  Every one of the six figures below the headline drops its reserved third line, so the grid's two
  rows sit noticeably tighter with no dead space beneath the numbers. Current gold still marks a
  stale reading, but as a small always-present marker beside the figure instead: dark and out of the
  way while the reading is fresh, lit up once it's genuinely stale, with the exact age reachable by
  hovering or focusing it — same as the XP figure's own explanation above. The marker takes up the
  same space whether or not it's showing, so a reading going stale mid-session never nudges anything
  beside it.

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

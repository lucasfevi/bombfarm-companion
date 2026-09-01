# @bombfarm/desktop

## 0.9.1

### Patch Changes

- 50022bd: Check for new market prices every 15 minutes instead of every six hours.

  The published price snapshot used to be rebuilt on a six-hourly schedule, and the app's own
  re-download interval was set to match it. The snapshot is produced continuously now, so a
  six-hour wait tracked nothing — it only meant an app left open could sit on prices hours older
  than the ones already published.

  The check is conditional, so this costs almost nothing: when the file has not changed the app
  sends its copy's validator, gets no body back, adopts nothing and announces nothing, which is
  also why nothing on screen flickers on a check that found no news. The per-item refresh button
  and the stamp saying how old a price is are unchanged.

- Updated dependencies [3110bde]
  - @bombfarm/pricing@0.1.6

## 0.9.0

### Minor Changes

- 18a722d: Set the app in a face whose digits are all one width, so numbers stop jittering as they count

  Every figure in the app re-flowed while it was on screen. The body face shipped no tabular
  figures, which meant `1` rendered at barely half the width of `8` — measured at 20px, 6.56px
  against 12.33px — and the ~105 places that asked for `font-variant-numeric: tabular-nums` got
  nothing back, because a face without tabular figures has no such feature to switch on. Every
  live reading therefore changed width as its own digits changed, dragging whatever sat beside it.

  The body face is now IBM Plex Sans, whose digits are equal-width with no feature required, so
  they hold still even where nothing asked. It is the superfamily of the mono face the app already
  loaded, so the figures that are deliberately set in mono — the hero energy readings, the rest
  countdowns — now sit beside their own sans rather than an unrelated one.

  A face cannot fix the other half: no figure stops `9` becoming `10`. The Live screen's rotation
  counts sat content-sized in a row, so a roster crossing nine heroes in one state widened that
  badge and shoved the three beside it sideways. Each count now reserves a slot wide enough for
  two digits, on the desktop Live screen and on the download page's replica of it.

  The Live earnings panel's current-gold figure also sat 16px left of the five figures beside it.
  Its staleness marker is always mounted — merely invisible while the reading is fresh, so that
  showing it never resizes the tile — but it sat after the number and pushed it off the tile's right
  edge. The marker now hangs to the number's left, the way the hero row's direction caret already
  does.

  Two notes on the new face. It tops out at weight 700, so the few `font-extrabold` and
  `font-black` headings and hero-rank badges now render at bold rather than heavier. Link-preview
  cards are regenerated in the new face by the same script that draws them.

### Patch Changes

- bc88553: Keep the median and 24-hour volume Steam quotes alongside the lowest price.

  The market quote endpoint returns three numbers for every item it is asked about — the lowest live
  listing, the median of recent sales, and how many units sold in the last day — and the sweep read
  the first and discarded the other two, on calls it had already paid for. All three are now carried
  through the pass that fetches them.

  Nothing about the published snapshot moves: its entries still carry the lowest price per currency,
  its schema version is unchanged, and its bytes are identical for the same market. No app needs a
  change to read it, and none of this is visible in the planner or the desktop app yet — the extra
  numbers exist so that price history has something to record when it arrives.

  The desktop app's per-item refresh reads the lowest price out of the wider answer, and keeps
  treating Steam answering without a price as "not quoted" rather than as a price of nothing, so the
  snapshot's own figure still stands in that case.

- Updated dependencies [18a722d]
- Updated dependencies [bc88553]
  - @bombfarm/ui@0.9.0
  - @bombfarm/pricing@0.1.5
  - @bombfarm/farm@0.2.1
  - @bombfarm/game-art@0.3.4

## 0.8.1

### Patch Changes

- Updated dependencies [7763419]
  - @bombfarm/pricing@0.1.4

## 0.8.0

### Minor Changes

- 4b76ad3: Give the desktop app the Farm screen the web planner has had: the map ranking board over every
  phase, and the per-map explorer beneath it. Same board, same explorer, same controls — at full
  screen the two read the same, and the layout falls to two columns on a narrow window exactly
  where the web does.

  It computes once, when you open the tab. The desktop reads your account from the running game
  every few seconds, and recomputing six hundred rows on every one of those reads would be both
  wasteful and unsettling to look at — figures moving while you are trying to compare them. So the
  board takes a snapshot when you arrive and holds it. Beside the board's heading, a refresh is
  always there, saying how long ago the numbers were worked out, so you can work them out again
  whenever you like. When the account moves on underneath, that same line says the numbers are out
  of date rather than quietly swapping them. It only says so when the account moved in a way the
  board would rank differently for — your gold balance ticking
  up is not one, and the board never reads a balance. Your own edits
  still apply immediately: changing the rotation pool or the return bonus recomputes there and then,
  because those are inputs you chose rather than a tick you did not.

  The screen shares its implementation with the web one rather than redrawing it. Both apps now
  render the same components from `@bombfarm/farm`, over the same compute, against the same strings;
  each supplies its own data and its own labels. A screen drawn twice drifts, and this one is far
  too large to keep honest by review.

  Two things differ from the web, both because the desktop has no roster to edit. The hero picker
  offers the heroes to inspect without the enable/disable switch that would have nowhere to save,
  and the empty-roster state points at the game rather than at a planner page. The respec advisor is
  present in full: it is advice about where to spend points, which is worth as much beside a live
  account as beside a plan.

  The advisor now says on every proposal that this is the best build the search found and not proof
  that no better one exists — on both surfaces. That was true of every answer it has ever given, but
  it only said so when the search had run out of room to keep looking, so the rest of the time its
  silence read as a guarantee it cannot make. The note about running out of room stays, saying only
  the narrower thing it knows: this search stopped at its limit on how many builds it may check,
  rather than because it had run out of improvements to make.

  The rotation pool now lays its hero cards out more densely when it is given a narrow column, so
  the ranking table stays visible on a small window instead of starting below the fold. The web
  planner's column is wide enough that its pool is unchanged.

### Patch Changes

- b02478e: Fix Settings → Updates claiming "Updates are off in this build" on installed Beta and stable
  builds. Main answers the renderer's one status read before it has finished building the update
  service, and that pre-service answer said `disabled` — a claim about the build rather than about
  readiness, and one that greys out the check button that would otherwise disprove it. It now
  reports the flavor's real capability, and the settled status is pushed once the service exists.

  Add an update indicator to the desktop footer, left of the version. It appears when an update is
  found, stays through the download, and ends on "Restart to update"; clicking it opens Settings →
  Updates, where the controls already live.

- 090f1ce: Typecheck the desktop renderer at the repo's own strictness bar.

  The renderer's tsconfig came from a stock Next.js template: it set `strict` and stopped there,
  never extending `tsconfig.base.json`. Two flags the base turns on — `exactOptionalPropertyTypes`
  and `noUncheckedIndexedAccess` — were therefore off for every renderer file, and the desktop's
  typecheck was passing at a bar looser than the rest of the repo. ESLint parsed the same files
  through a base-tier program but only ever reports its own rules, so around fifty real type errors
  sat in the renderer with every check green.

  The renderer project now extends the base, and the errors that surfaced are fixed rather than
  suppressed. Most were optional React props declared `?: T` while the caller passes a computed
  `T | undefined` — a distinction `exactOptionalPropertyTypes` draws and React does not, so those
  props now say `?: T | undefined`. Three were genuine unchecked reads: a hero's rarity index past
  the end of the rarity list produced an undefined tier rather than the documented "unknown", the
  toast queue re-read a coalesced entry by an index it had already proved, and `DEFAULT_INVENTORY_SORT`
  could not tell a consumer that it always has a leading term.

  A guard asserts the resolved strictness of both desktop projects, so this cannot silently lapse
  again.

  Lint's desktop project is split in two along the same seam. It had been one program spanning the
  main process and the renderer — two runtimes that never share a global scope, and whose global
  declarations contradict each other on purpose. Each half now has its own project, so the program
  lint builds is one a compiler could actually accept.

- Updated dependencies [4b76ad3]
- Updated dependencies [5e2aa87]
- Updated dependencies [b02478e]
- Updated dependencies [090f1ce]
- Updated dependencies [972e2d1]
  - @bombfarm/farm@0.2.0
  - @bombfarm/ui@0.8.0
  - @bombfarm/pricing@0.1.3
  - @bombfarm/contracts@0.6.1
  - @bombfarm/game-art@0.3.3
  - @bombfarm/domain@0.10.1
  - @bombfarm/game-api@0.3.5
  - @bombfarm/game-data@0.0.11

## 0.7.2

### Patch Changes

- Updated dependencies [fa1d5fa]
  - @bombfarm/pricing@0.1.2

## 0.7.1

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

- Updated dependencies [a33317f]
- Updated dependencies [af7bd8c]
  - @bombfarm/game-api@0.3.4
  - @bombfarm/domain@0.10.0
  - @bombfarm/ui@0.7.1
  - @bombfarm/game-art@0.3.2

## 0.7.0

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

- c94648a: Stop the window sticking and jumping while it is dragged, and stop the main process being blocked
  for a fifth of every second while the game is running.

  Finding the game is a PowerShell spawn — `Get-Process` through `powershell -NoProfile`, measured at
  166ms per call on the development machine, and a cold start every time, so it does not amortise.
  `runPowerShellSync`'s own doc comment already said it was "for call sites that run once per attach,
  not on a recurring poll". The game reader's live tick called it directly, and that tick runs every
  50ms for as long as the game is connected: the main process was spending more than three times its
  own poll budget inside a child process, permanently.

  Electron's main process is single-threaded, and the window's message loop is on that thread. A
  frameless window being dragged is moved by that loop, so the drag froze and lurched in step with
  the spawns. The offline development mode never showed it because the fixture tick never asks who is
  running — which is why this survived several attempts to find it in the shell and the renderer,
  where it never was.

  Two changes, because the two states fail differently:

  - **While the game is running**, a pid already in hand is verified with `process.kill(pid, 0)` — a
    syscall rather than a process — so the connected poll looks nothing up at all.
  - **While the game is closed**, there is no pid to verify and the lookup is unavoidable, so it is
    now awaited rather than blocked on. The next poll is scheduled after the tick finishes rather
    than alongside it, so a slow lookup cannot stack ticks behind it.

  Measured on the real read path, driving the same polls:

  |                                                      | before           | after |
  | ---------------------------------------------------- | ---------------- | ----- |
  | main-process event-loop lag, p90 (game running)      | 182 ms           | 12 ms |
  | main-process event-loop lag, worst (game running)    | 262 ms           | 14 ms |
  | drag samples where the window did not move           | 74.9%            | 1.1%  |
  | catch-up jumps per drag                              | 12               | 1     |
  | largest catch-up jump                                | 36 px            | 3 px  |
  | main-thread freezes over 50 ms in 35 s (game closed) | 5, of 159–191 ms | 0     |

  The synchronous way to _find_ a process is gone rather than left beside the async one, so nothing
  can reach for it again; `runPowerShellSync` itself stays, for the one-shot callers it was written
  for. A guard reads the source and fails if either the blocking helper or a per-tick lookup returns
  — the previous rule was a doc comment four lines above the call site that broke it, and the
  behaviour is identical either way, so nothing observable would have caught it.

  The pid is also dropped when consent is withdrawn: identifying the player's game process is one of
  the things that gate covers, so the answer is not held across a revocation.

- Updated dependencies [3eb7026]
- Updated dependencies [c94648a]
- Updated dependencies [3233351]
  - @bombfarm/contracts@0.6.0
  - @bombfarm/ui@0.7.0
  - @bombfarm/domain@0.9.1
  - @bombfarm/game-api@0.3.3
  - @bombfarm/game-data@0.0.10
  - @bombfarm/pricing@0.1.1
  - @bombfarm/game-art@0.3.1

## 0.6.0

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

- 4836894: Give the desktop a fixed measure, put the Live tab's two readings side by side at every window
  size, and close the second scrollbar.

  The app content now stops widening at 1440px and centres itself, so a wide monitor grows the
  background instead of stretching the panels across it. Below that it fills the window as before.

  On the Live tab, the gold/hr panel and the map panel sit side by side at every size the window can
  be dragged to, including the smallest. They used to need a window wider than the one the app opens
  at, so a fresh launch showed them stacked — the split made both columns as wide as the fixed-width
  gold panel, which is far wider than the map needs. The gold panel now takes its own content width
  and the map takes the rest, which is also the half that reads better with the extra room. A little
  spacing came out of both panels to bring the pair inside the smallest window; nothing was removed.

  Settings now reads as a stack of panels like every other tab, instead of loose rows on the page
  background. Its rows are a label at one edge and a control at the other, so they get a tighter
  measure of their own rather than the full width — the control no longer sits a screen away from
  the label it belongs to.

  The window itself can no longer scroll, so the Live tab never shows two scrollbars again. Screen
  reader labels are positioned elements, and with nothing positioned above them they escaped every
  attempt to clip the content: a long enough hero list pushed them past the bottom of the window and
  the window grew a scrollbar of its own beside the one the content already had.

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

- 48ae346: Give the list layout the cards' own filters, and head the inventory with what it is worth.

  The toolbar moved out of the card layout into a component both layouts render, so the list offers
  the same search, kind, rarity, hero and set narrowing instead of a search box alone. Only the sort
  pair is hidden there: that layout sorts through its own column headers, and two controls for one
  order is one too many.

  A new `Priced` narrowing shows just the items the market is quoting right now. It is the first
  filter term that is not a property of the item — it depends on a snapshot the domain cannot see —
  so `filterInventoryView` takes the predicate from the caller, and with no predicate nothing is
  priced, which is the truthful answer when there is no snapshot to ask.

  The header states the market value of everything owned, over the count it could reach: `20 of 171
tradable items priced`. Untradable items stay out of that denominator, since the game forbids
  selling them and counting them would make the coverage read worse than it is. The figure is taken
  over the whole inventory rather than the filtered view, so narrowing to one set does not restate
  it as a smaller fortune.

  The items now scroll inside their own region rather than taking the window with them, so the
  toolbar and the totals stay put while a long inventory moves under them.

- 48ae346: Lead the inventory with what it is worth, and switch layout from the list's own corner.

  The market total is now the largest thing on the screen rather than a line of small print — it is
  the reason to open the page, so it reads as the headline. How old the prices are moved in beside
  the coverage line, where it qualifies the figure instead of competing with it.

  Cards or list is two icons in the toolbar's right corner, next to the list they switch, rather
  than two words above the panel heading. Each keeps its word as its accessible name and its tooltip.
  The pair is one shared component both shells render: written per shell it was duplicated Tailwind,
  which the desktop's prose-literal guard is right to object to.

  The web planner's price refresh button is gone. It could only re-download the same six-hourly file
  — the planner cannot ask Steam anything — so it promised a freshness it had no way to deliver. The
  desktop keeps its per-item refresh, which really does re-quote.

- 48ae346: Show what the market is asking for each item you own, and offer the inventory as a sortable list
  beside the cards.

  Every item now carries its Steam Community Market price above the in-game gold value, linking to
  the listing it came from. The figure is the one Steam quotes in that currency, so it matches the
  page behind the link; where Steam declined to quote it, the price is converted from USD and marked
  approximate rather than presented as exact. Each price says how old the quote behind it is, dated
  by that quote rather than by the file that carried it.

  The new list layout is a real table: sortable column headers that carry `aria-sort` and activate
  through a real button, numeric columns aligned on their digits, and a per-row action named after
  its own item so a screen reader hears "Refresh the market price for Coal Boots" rather than a
  column of identical labels. Sorting reuses the cards' own multi-term model, so picking a second
  column keeps the first as the tie-break, and it sorts within a kind rather than across — a key
  never lands between two swords. Items the market has no price for sink to the bottom whichever
  direction is chosen, instead of crowding out real prices on a cheapest-first sort.

  The chosen layout is remembered per browser. A shell with no snapshot renders exactly as it did
  before, price column and all.

- 19197cc: Add a Map panel to the Live tab, beside the earnings figures: which map is being played (its
  in-game difficulty coordinate, its flavour name and its phase number), how much of the map's
  health is left, and how many props are still standing out of the total a fresh map of that phase
  spawns.

  Every figure comes from the live combat stream and is folded once in the main process, so the
  panel only ever formats finished values. Health and the prop count are reported independently —
  one absent from a tick reads as "not sent" rather than zero, and a map with nothing left standing
  reports zero props rather than a dash. The prop total comes from the phase's own wiki row rather
  than from the stream, so it is correct immediately instead of only after the first map completes.

  It also reports what the map is worth: XP per prop with the account's own skill-tree multiplier
  applied, average gold per prop, and average gold for a full clear. Those three are modelled from
  the map's wiki row rather than measured, and the panel marks them as estimates — the measured
  gold/hr and XP/hr sit immediately beside them, and the two must not read as the same kind of
  number. They come from the same `computePhaseIntelGlobal` the web planner's Phases screen uses, so
  a figure cannot say one thing on the Live tab and another on Phases.

- a863d2f: Remove the Planning tab from the desktop app.

  The desktop nav is now Live, Inventory and Settings. The hero roster, the next-point ranking, the
  solo DPS figure and the reset advice are gone from the desktop; the web planner still offers all
  of them, and nothing about how it computes them has changed.

  Two notices that only ever appeared on that screen go with it: the provenance panel that named
  which parts of your account were remembered rather than freshly read, and the warning that the
  app's save location is unavailable so nothing will survive a restart. No other screen showed
  either one.

### Patch Changes

- b7d837a: Fix live data no longer appearing on the Live tab. The game's combat traffic changed to a
  compressed binary frame instead of the earlier plain-text one, and the app was silently
  discarding every frame instead of decoding it — the connection stayed marked "connected" the
  whole time, with nothing to show that data had stopped arriving. Both frame shapes now decode to
  the same tick, and a payload that still cannot be decoded at all is now logged once per session so
  this class of breakage is never silent again.
- 48ae346: Open external links in the default browser instead of inside the desktop app.

  A link to a third-party site — the market listings the inventory now points at — used to open an
  in-app Chromium window with the app's own privileges, and a link without `target="_blank"` would
  have navigated the app's own window away from the renderer with no way back. Both now hand the URL
  to the system browser and leave the app where it was.

  Only `https:` may leave the app. Every other scheme, a malformed URL included, is refused and
  logged rather than handed to the operating system, and no in-app window is created for an external
  page at all. The renderer's own bundle keeps navigating normally.

- c0ef094: Fix installed builds closing themselves a moment after launch.

  Every installed build — Nightly, Beta, and stable alike — opened its window, then quit. The
  updater is the last thing boot starts, and it failed while wiring its logger, which took the whole
  launch down with it. Local development runs were unaffected, because a build with no installer to
  replace never starts the updater at all, which is why this reached a release before it was seen.

  Boot no longer treats the updater as load-bearing either. An app that cannot check for updates is
  still a working app, so a failure there now stops at the Updates section, which says the check
  failed, instead of closing the window. It reports a failure rather than the no-channel wording a
  local development build gets — telling someone on an installed build that their flavor does not
  update would be false, and would hide the problem rather than show it.

  Nothing else about updating changes; it now runs where before it stopped the app.

- b7d837a: Fix every authenticated account read failing. The game's own server moved its API to a new
  address and withdrew the old one from DNS entirely, so every request the app made was failing
  outright. The app now targets the new address, and the first-run consent screen's privacy
  disclosure — which names the address your session token is sent to — has been corrected to match;
  what it promises (your token goes only to the game's own server, never anywhere else) is unchanged.

  **You will be asked for consent again.** A grant records which disclosure you agreed to, and this
  one names a different address than the one you saw. Consent given for the old wording is not
  treated as consent for the new, so the app asks once more rather than assuming. Account reads stay
  paused until you answer.

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

- b7d837a: The Live tab's "nothing read yet" empty state no longer tells you to open the game when it is
  already open and the app is simply still attaching — it now states the real reason nothing has
  arrived (not yet connected this session, waiting on the game, a runtime issue, and so on), reusing
  the same wording already shown once attached. If consent for reading the account is missing, the
  empty state now offers the control to grant it again instead of leaving no way forward.
- 8ba7408: Fix the energy bar and percentage on the Live tab lagging up to a minute behind the countdown
  printed beside them. The countdown was refreshed four times a second, but the percentage came from
  the authenticated account read that only lands once a minute, so a hero could sit at "0:00" with a
  bar still reading 99% — two numbers describing the same hero, disagreeing. Both readings now come
  from the same fast channel: a hero on the field shows the energy the live stream actually observed,
  and a hero resting shows the exact inverse of the recovery clock next to it, so the bar reaches full
  at the instant the clock runs out. Queued and benched heroes have no live reading available and are
  unchanged.
- 3da228e: Fix the Live and Inventory tabs falling back to "Loading…" every time you came back to them from
  another tab. Both screens set their data up and tore it down with the tab itself, so leaving
  dropped the subscription and threw away everything already on screen; returning started over from
  an empty screen and waited on a fresh read before it could show anything. Both now follow the game
  for as long as the window is open and paint current numbers on the first frame back, with no gap
  for whatever arrived while you were away, and no repeated account or price read on each visit.
- b7d837a: Add `SpriteLoop`, a shared preloading, reduced-motion-aware pixel-art frame loop, generalised out
  of the web team-plan optimizing modal's hero6 bomb-activation animation so both apps can reuse the
  same implementation. `SpriteLoop` now also takes an `animate` prop to hold the loop on its first
  frame on demand, independent of reduced-motion. The web modal's own animation is unchanged.

  The desktop Live tab's "waiting for the first account read" screen now shows Hero 6's pixel-art
  idle animation while the app is reading the account or retrying a connection gap on its own, so a
  long wait reads as working rather than stalled. The sprite holds still on its first frame while
  consent is missing, since nothing is actually in progress in that state, and it honours
  reduced-motion settings.

- 48ae346: Show the market price and refresh hints in the app's own tooltip instead of the browser's.

  The Steam price figure and the per-item refresh control carried their explanation on the native
  `title` attribute, which is OS chrome: unstyled, untouched by the app's theme, on a delay the
  browser owns, and shown neither on touch nor on keyboard focus — so the quote's basis and age were
  invisible to anyone not hovering a mouse. Both now use the design-system tooltip, which appears on
  keyboard focus as well as hover. The price link keeps opening the listing in a new tab and stays
  reachable by keyboard, and an untradable item still renders nothing at all.

  Lint now rejects the native attribute on a DOM element across the design system, the game-art
  package, the desktop renderer and the web planner, so the next one cannot land unnoticed.

- Updated dependencies [c3dd984]
- Updated dependencies [4836894]
- Updated dependencies [48ae346]
- Updated dependencies [b7d837a]
- Updated dependencies [48ae346]
- Updated dependencies [48ae346]
- Updated dependencies [48ae346]
- Updated dependencies [b7d837a]
- Updated dependencies [b7d837a]
- Updated dependencies [8ba7408]
- Updated dependencies [19197cc]
- Updated dependencies [b7d837a]
- Updated dependencies [19a8c45]
- Updated dependencies [48ae346]
- Updated dependencies [48ae346]
- Updated dependencies [48ae346]
  - @bombfarm/contracts@0.5.0
  - @bombfarm/ui@0.6.0
  - @bombfarm/game-api@0.3.2
  - @bombfarm/game-art@0.3.0
  - @bombfarm/domain@0.9.0
  - @bombfarm/pricing@0.1.0
  - @bombfarm/game-data@0.0.9

## 0.5.1

### Patch Changes

- Updated dependencies [74e3119]
  - @bombfarm/domain@0.8.1
  - @bombfarm/game-api@0.3.1
  - @bombfarm/game-art@0.2.1

## 0.5.0

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

- dec4425: The desktop window now draws Windows' native Minimize/Maximize/Close overlay directly on top of
  the app's own top bar instead of a separate OS title bar above it — the top bar is draggable, and
  its brand, nav, and PT/EN toggle stay clickable. The header reserves room for the overlay buttons
  at runtime, from the actual area Windows hands back, rather than a hardcoded width.
- dec4425: The desktop app's shell now uses the same sticky top-bar shape as the web planner — a brand
  lockup, a segmented Live/Planning/Settings pill, and a right-hand actions area — instead of its
  former left icon rail. The desktop's PT/EN language switch moved from Settings-only into that top
  bar (Settings keeps its own control too; both stay in sync), and the nav no longer carries icons.

  The web's segmented nav pill and its bordered PT/EN toggle are extracted into two new shared
  `@bombfarm/ui` primitives, `AppNav` and `SegmentedToggle`, so both apps render identical chrome
  from one implementation. The web's own header keeps its exact appearance and behavior; only its
  internals now call the shared primitives.

- d7c1565: Inventory cards that show the whole item, and a way to find one

  Every card now carries the game's own art: the lit rarity plate behind the icon, at the size the
  planner draws gear, and a real sprite for the things that had none — gems, keys, house parts,
  skill stones and chests. Gear lists the stats it actually gives you, with the forge already
  applied, so a +12 reads as what you get rather than what it rolled. The bottom of every card is a
  fixed row: the hero wearing it on the left, in their own rarity colour with their level, and what
  it sells for on the right, beside the coin.

  Each kind of item now gets the card it deserves. A gem has no level and no forge, so it no longer
  shows "Lv 0" — it shows its name and its tier and nothing it does not have. And because a stack of
  27 identical keys is one thing you own rather than 27, everything but gear is grouped into a
  single card with a count and the stack's total value. Chests and skill stones get their own
  sections rather than falling into "Other", which is where the app used to put them.

  Above the grid there is now a search box, sorting, and filters — by kind, by rarity, by the hero
  wearing it, by set, and equipped-only — so finding one item among several hundred does not mean
  scrolling. Search matches the item's name in your own language as well as the game's internal id.

  Filtering by set is how you filter by level: every set sits at exactly one item level, so the list
  reads "Lv 30 · Coal" and is ordered by level. It starts with everything chosen, shows how many
  pieces of each set you own — 41 beside Coal tells you it is most of your gear before you have
  filtered anything — and offers whichever of "Clear" and "Select all" would actually change
  something. Only gear has a set, so narrowing here shows gear alone.

  The English planner also stops showing Portuguese item names. Gear was being named by
  title-casing the game's own slot token, so an English player saw "Gold · Elmo" where they should
  have seen "Gold · Helm".

- d7c1565: An Inventory screen that shows every item you own, not just the gear

  Both the planner and the desktop app now have an Inventory tab listing everything the account
  carries, grouped by kind — gear, gems, keys, materials — with each item's level, forge, set and
  slot, what it sells for, whether it is stashed or locked, and the hero wearing it. Each card is
  framed in its item's rarity colour, and the hero on the "equipped by" line is named in the hero's
  own rarity colour with their level, so you can tell at a glance whose gear you are looking at.

  Until now the only item list either app kept was the optimizer's pool, which holds gear and
  nothing else: keys and anything else you own were read from the save and then dropped on the
  floor. That pool is unchanged and still gear-only — the optimizer wants exactly the items it can
  equip — so this is a second, separate list rather than a widening of the first.

  Items the app cannot name yet get their own group instead of being quietly filed as gear. The
  item list this app ships covers gear only, so a key, or an item type a future game update
  introduces, has no name to show; those appear under "Other", labelled as unrecognised and
  carrying the kind number the game sent, rather than being shown as a piece of gear with a slot it
  does not have. Guessing would be worse than admitting the gap: it would put an unequippable item
  in front of you as if it were equippable.

- dec4425: The Live screen's hero row now shows the hero's level, matching the three-line identity block
  (rank+name / rarity / level) the web planner already shows for a rotation-pool hero — previously
  the row stopped at rarity.

  Under the hood, that three-line block is now one shared component (`HeroIdentity`, new in
  `@bombfarm/game-art`) built from primitives rather than a full hero record, so the Live screen (a
  partial, streaming roster join) and the web planner (a complete `HeroRecord`) render identical
  chrome from the same source. `HeroIdentityChip` is now a thin adapter over it for `HeroRecord`
  callers; its own rendered output for the web planner is unchanged.

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

- bd36215: Add `pnpm dev:offline` — the desktop app with no game running and no server reachable.

  The account sections come from a committed fixture payload instead of the five REST routes, and
  the live tick stream is replayed from a recorded byte capture through the same decoder the real
  tap uses, rather than from a hook into the game process. Replay mode never lists processes and
  never loads the instrumentation runtime, so a dev build in this mode can run beside a packaged
  build tapping the real game.

  Both overrides are refused in a packaged build: `isReplayLiveSourceEnabled` takes `isPackaged` as
  an argument rather than reading it, so a real install has no path into either whatever its
  environment says.

- dec4425: Desktop Planning now shows the same hero art as the web planner: a rarity-tinted avatar in the
  roster list and on the selected hero's detail card, plus the rarity label coloured to match. The
  hero-avatar/rank/rarity/gear/ability icon components moved out of the web app into a new shared
  `@bombfarm/game-art` package so both apps render identical chrome; the web planner's own call
  sites are unchanged.

### Patch Changes

- f8f6832: Stopping the tap now waits for the read hook to actually be removed

  Withdrawing consent stops the tap before the withdrawal is recorded. That stop was only ever
  _started_, though: detaching a session kicked off the script unload and returned immediately, so
  the app recorded the revoke and told the player the tap had stopped while the injected read hook
  was still resident and could still deliver a frame.

  Detaching now returns a promise that settles once the unload and the underlying detach have both
  finished, and the tap waits for it. Because that wait crosses into the instrumented process, it is
  bounded: a runtime that does not answer within a couple of seconds is abandoned with a log record
  rather than holding the settings screen open indefinitely. The guarantee is now the one the code
  claims, and the one case where it cannot be kept says so out loud.

- f8f6832: Withdrawing consent stops the live tap on any route out of a granted record, not just the one

  Withdrawing consent has always had to stop the tap reading _before_ the withdrawal is recorded,
  because the tap only consults consent when deciding whether to attach and never re-checks a session
  already in progress. That ordering used to live in a single IPC handler, wired for one specific
  event, while every other consumer of a consent change was notified from the shared path.

  It now lives in that shared path too, and is keyed on the transition rather than on the event: any
  record the read gate currently accepts, moving to one it rejects, tears the session down first —
  whichever route gets it there. A future second exit from a granted record inherits the guarantee
  instead of needing someone to remember it, and the failure it would otherwise have caused, the tap
  reading on past the moment permission was withdrawn, is silent — exactly the kind that should not
  depend on memory.

- 1d9d79f: Field countdowns are computed from the drain law, not measured from the frame stream

  Every earlier attempt at this fix — fitting a rate from the frame stream, smoothing it, blending
  it with a modelled fallback, then rebasing it on a shared frame clock — reduced the stutter without
  removing it, because it was solving the wrong problem. The drain rate is not something that needs
  measuring: it is a published rule the app already implements (own drain-reduction and the team's
  Fôlego de Mineiro aura, additive, capped, floored) and already resolves the inputs for. A hero's
  remaining field time is exactly `energy ÷ drainRate` — exact on the very first reading, with no
  clock, no warm-up, and no way to jitter.

  The frame-counting clock, the per-frame energy-delta tracking, the shared frames-to-seconds
  constant, the skipped-frame heuristics, the trust gates, and the never-rising clamp that
  compensated for their noise are gone — none of it is needed once the number is derived rather than
  observed. `basis` now reports `'modelled'` for every field countdown; that used to mean an
  estimate standing in for a better one, and now means exactly what it always should have: derived
  from the rule, not sampled from noisy frame arrivals.

  The measured rate lives on as a background check: computed cheaply from the same frames, it never
  feeds the display, and logs once if it disagrees with the law by more than a small margin — the
  one way the app would ever notice a hero carrying both drain-reduction effects behaving
  differently than the additive rule predicts, a combination nothing has measured yet.

- dec4425: Dragging the window by its header no longer stutters or snaps back. The header carried a sticky
  position, a stacking context and a backdrop blur inherited from the web planner, none of which
  applies in a shell whose main region is the only thing that scrolls, and all of which put the
  header on its own compositing layer — the layer the OS drags once the header is the title bar.

  The header also now matches the caption strip beside it exactly, instead of sitting a shade
  darker than it.

  On the Live screen, the four field lists — on field, recovering, queued, benched — sit two to a
  row instead of four full-width rows, so the whole field reads without scrolling past whichever
  list is longest. They still stack on a narrow window.

- f8f6832: A corrupt live frame no longer takes the good frames sharing its network read down with it

  A single TLS read routinely carries several combat frames. When one of them failed to decode, the
  frames already decoded ahead of it were delivered, but every remaining byte of that read was thrown
  away — including whole valid frames that had already arrived behind the corrupt one. The loss was
  silent: the live panel just missed a beat, and a diagnostics dump came back missing frames it
  should have held.

  Measured on the committed synthetic stream at a 4 KiB chunk size, 32 of 34 frames decoded. The two
  casualties were the frame sitting entirely inside the discarded remainder and the one straddling
  the chunk boundary. The decode failure now carries those unconsumed bytes with it, so they reach
  the same frame-boundary resync scan that already recovers the rest of the connection. The same
  fixture now decodes 33 of 34 — the deliberately malformed frame is the only loss, which is the most
  any decoder can do.

- 5a4620b: The Live screen is one Heroes panel of cards, each with its energy

  The four hero lists — Field, Recovering, Waiting for a rest slot, Benched — were four separate
  panels laid out two-across, so the screen read as four things that happened to be about heroes
  rather than one roster in four states. They are now four subsections of a single Heroes panel,
  stacked in the order a hero moves through them: Field, Resting, Idle, Benched. Each heading reads
  its own count against its own cap — "Field · 7/9", "Resting · 3/5", "Idle · 4".

  Each hero is a card in a grid that reflows to the window rather than a row in a list, so a full
  field of nine no longer forces a column of nine lines beside three empty panels. Benched heroes are
  drained of colour, which is the one state that means "not in the rotation at all".

  Every card now carries an energy bar. That is what makes one Idle section enough: the list holds
  both a hero at full energy waiting for a field slot and a hero part-filled waiting for a rest slot,
  and until now nothing on the screen told them apart. The reading is floored, never rounded, so only
  a hero at exactly full energy reads 100%; a hero whose energy was never sent says so rather than
  drawing an empty bar that would claim zero.

  Both caps say what raises them, while the account is below them — buying field slots in the skill
  tree, moving up to a later house for rest slots. The rest-slot ceiling comes from the account's own per-house ladder when
  the game sends one, so an account that differs from the reference values is measured against itself.
  Each hint stays silent when its cap is unknown, rather than giving advice with no fact under it.

  The House panel is gone, and every reading it carried now heads the Resting section, where the
  heroes those readings are about actually are: the rest slots they are competing for, how long a full
  refill takes, and how many skips the day has left — "no skips left today" once the day is spent,
  rather than counting zero of fifteen. The active house and its level are no longer shown; they
  named a house by a raw zero-based index and changed nothing a player does from this screen.

  Countdowns now all read in one colour. They did not before: a field time the app had to model
  rather than read, and a rest clock that was not advancing, were both dimmed, and a legend at the
  bottom of the screen explained a dashed underline that no longer existed. A number that dims as the
  live tap comes and goes reads as a different kind of number when it is the same reading from a
  second-best basis. Screen readers still hear which countdowns are estimates and which are paused,
  and the legend is gone.

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

- dec4425: Live screen and header polish from direct feedback on the running app

  `AppShell` gains an optional `brand` slot, and the shared design system exports a `BrandMark` —
  an inline rendering of the header mark's five shapes rather than a binary asset either app would
  need its own copy step for. The desktop now shows it beside its title, matching the web's own
  header mark.

  The desktop's Live screen showed two vertical scrollbars: the real one on its hero lists, plus an
  always-reserved empty gutter meant for the web's own page scroll. That gutter rule now lives only
  in the web's stylesheet.

  On the Live screen: hero avatars beside the three-line stacked identity are bigger, so the row
  reads as one block instead of a small icon dwarfed by its own text. The dashed underline under
  field/rest countdowns is gone from both the modelled and direct-reading states — the row already
  never reflowed when the basis flips (that's what the shared underline was protecting), and the
  text colour plus a screen-reader-only qualifier still carry the distinction. The standalone "Field
  slots in use" panel is gone; its count now lives in the on-field list's own header, as a plain
  `occupied/total` (or just `occupied` when the field size hasn't been sent). The on-field list
  itself is renamed "Field" ("Campo"), the name the retired panel used.

- f8f6832: Re-granting consent brings the live tap back even if a previous teardown failed

  Forcing the tap down stopped the old one and then replaced it. If the stop threw — which it can,
  when an attach is in flight and the instrumentation runtime fails to resolve at that moment — the
  replacement never happened, leaving the live source holding a tap whose poll loop was permanently
  stopped. Every later wake-up returned immediately, so re-granting consent produced nothing: the
  live panel stayed empty until the app was restarted, with only a log line to say why. The
  replacement now happens on both paths, while the failure itself still surfaces.

  Separately, decoding a network read no longer recurses once per malformed frame or once per HTTP
  response inside it. Recovering from a bad frame had been made to hand the rest of the read back to
  the frame-boundary resync, and reading back-to-back HTTP responses had always called itself — both
  grew the call stack in step with what a single read happened to contain, so a large enough one
  would have crashed the app outright. Both now iterate.

- 1d9d79f: The resting countdown now ticks in real time instead of jumping once a minute

  A resting hero's recovery countdown carried no time term at all — it was recomputed only when the
  account was re-read, roughly once a minute, and sat perfectly still in between while still
  reporting itself as advancing. It looked like a running clock and was actually a value that jumped
  once a minute and held flat the rest of the time.

  Recovery is a straight linear ramp over the house cycle, so it is now interpolated in real time
  from the last read: `remaining(now) = remainingAtRead - (now - readAt)`, floored at zero. Unlike
  the field countdown this is a subtraction, not a division, so a small timing error stays small.

  A hero recovers in the house on the server's own clock whether or not a battle is running, so the
  countdown advances whenever the app is still in touch with the game at all — not only while combat
  frames are streaming. It freezes, and reports itself as not advancing, only when the read path
  itself is down (the hook has gone silent, or the app was never attached); a paused combat stream
  with everything else still reachable is not treated as a loss of contact.

- 475e639: The account refresh cycle now stops issuing requests once the game is closed

  The account refresh cycle gated only on player consent and a readable session token file. The
  token file persists on disk after the game process exits, so the cycle kept issuing authenticated
  requests to the game's servers — every minute foregrounded, every five minutes backgrounded —
  long after there was nothing running to talk to.

  It now also checks whether the game is currently running, using the same live status the game
  reader already reports, and skips the cycle when it is not — consent still gates independently, so
  neither check can substitute for the other. The cycle keeps ticking either way, so the very next
  run after the game starts back up proceeds normally with no restart needed. Separately, the flag
  recorded alongside each commit is now read fresh at commit time instead of a stale literal, so a
  cycle spanning the moment the game exits reports that correctly too.

- Updated dependencies [f8f6832]
- Updated dependencies [fae49fb]
- Updated dependencies [dec4425]
- Updated dependencies [0e769ac]
- Updated dependencies [e637f31]
- Updated dependencies [1d9d79f]
- Updated dependencies [659fcc5]
- Updated dependencies [0e769ac]
- Updated dependencies [681643e]
- Updated dependencies [d7c1565]
- Updated dependencies [d7c1565]
- Updated dependencies [dec4425]
- Updated dependencies [dec4425]
- Updated dependencies [dec4425]
- Updated dependencies [5a4620b]
- Updated dependencies [7d3a951]
- Updated dependencies [dec4425]
- Updated dependencies [1d9d79f]
- Updated dependencies [82f93dd]
- Updated dependencies [550b376]
- Updated dependencies [1d9d79f]
- Updated dependencies [dec4425]
- Updated dependencies [d5a412c]
  - @bombfarm/tap-runtime@0.2.1
  - @bombfarm/contracts@0.4.0
  - @bombfarm/game-api@0.3.0
  - @bombfarm/ui@0.5.0
  - @bombfarm/domain@0.8.0
  - @bombfarm/game-art@0.2.0
  - @bombfarm/game-data@0.0.8

## 0.4.4

### Patch Changes

- Updated dependencies [8cb9912]
  - @bombfarm/domain@0.7.0
  - @bombfarm/game-api@0.2.5

## 0.4.3

### Patch Changes

- a84101b: Fix a packaged build failing to boot with `game-data fixtures directory not found`. `GameReaderService` loaded its dev/CI-only fixture bundle eagerly in a field initializer, so every instantiation resolved fixture paths regardless of read mode — paths that only exist in the monorepo source tree, never in an installed app. The fixture bundle is now loaded lazily, only when fixture mode actually needs it, so a normal (memory-mode) run never touches the filesystem for it.

  Fix a second, independent boot failure: an installed app launched from the Start menu could try to load the development server (`http://127.0.0.1:3000`) instead of its bundled renderer, failing with `ERR_CONNECTION_REFUSED`. Dev-mode detection relied solely on an environment variable that a packaged install never sets, so its absence was silently read as "development". It now also requires the app to be unpackaged, and requires an explicit dev signal (a renderer URL override or `NODE_ENV=development`) rather than merely the absence of `NODE_ENV=production`, so an unset environment can never be read as dev.

- a844381: Remove the process-memory reading path from the desktop app. The diagnostics snapshot panel now
  sources its gold/phase/wave reading from the in-run live data source instead of scanning the
  game's process memory directly, and the app no longer depends on a native FFI library to read a
  running game's memory. Account data was never sourced from process memory in the first place — it
  has always come from the authenticated periodic sync — so this has no effect on account, hero,
  skill, casa, or inventory data.
- 4cd94f9: Fix a self-healing gap in the live tap's hook discovery: a fresh scan that failed validation used
  to retry the identical top-4 ranked candidates forever, so a future game rebuild that pushed the
  real read function past rank 4 would leave the tap unable to attach no matter how long it waited.

  Repeated fresh-discovery validation failures now widen the requested candidate window (4 → 8 → 16
  → 32, then plateau) instead of repeating the same slice. The window resets to 4 once a winner is
  confirmed, and whenever the scanned build id changes, so a rebuild starts its own escalation rather
  than inheriting the previous build's widened window. A cache-sourced failure keeps its existing
  invalidate-and-retry behaviour unchanged.

- 4cd94f9: Add the `@bombfarm/tap-runtime` package: a Frida-backed implementation of the desktop app's
  process-instrumentation port. Until now `@bombfarm/tap-runtime` was named as the live tap's
  runtime dependency but never actually existed, so every attach attempt failed immediately and the
  live tap could never come up.

  The port's `attach()` is now asynchronous, matching Frida's own async attach/script lifecycle. The
  agent script that runs inside the target process (`agent.js`) moves into the new package unchanged
  and is embedded as a string at build time, alongside a small bridge that maps Frida's native hook
  and messaging primitives onto the same host contract the agent already expects.

  `frida` is a regular dependency now, kept external from the esbuild bundle and unpacked from the
  packaged app's asar archive so its native addon can load.

- Updated dependencies [d1dce84]
- Updated dependencies [a844381]
- Updated dependencies [4cd94f9]
  - @bombfarm/domain@0.6.3
  - @bombfarm/game-data@0.0.7
  - @bombfarm/contracts@0.3.4
  - @bombfarm/tap-runtime@0.2.0
  - @bombfarm/game-api@0.2.4

## 0.4.2

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

- Updated dependencies [8692c92]
- Updated dependencies [587ed60]
- Updated dependencies [dbb38f1]
- Updated dependencies [da61de5]
  - @bombfarm/contracts@0.3.3
  - @bombfarm/domain@0.6.2
  - @bombfarm/game-api@0.2.3
  - @bombfarm/game-data@0.0.6

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

  `packages/domain/src/roster-dps.ts`'s `pipelineForHero` is now a public export: the
  only `HeroRecord`-shaped entry to the pipeline, and the one mapping both surfaces use. Its body is
  byte-unchanged; a layer-1 parity test (`packages/domain/tests/pipeline-for-hero-parity.test.ts`)
  and a layer-2 source-derived key-set guard (`tools/advisor-input-parity.test.mjs`) together prove
  the desktop and the web compute identical ranked stats and gains for the same account payload,
  for every observed `crit_dmg_mult`. The one known, pinned divergence (`treeCritDmgMult`)
  is documented at the export site and asserted not to widen or silently close — it is not fixed
  here, because doing so would change the web planner's own rendered numbers.

  **Honesty over completeness, by construction (`D24`).** Every number the desktop shows is gated
  by the usability of the account sections it depends on (`resolved`/`stale` render; `missing`/
  `degraded` withhold, never a fallback). An exhaustive, table-driven matrix
  (`apps/desktop/renderer/lib/planning/withhold-matrix.test.ts`) asserts the fallback numbers
  `import-save.ts`'s zero-tree default would otherwise produce are never reachable when their
  backing data is not trustworthy.

  **No behaviour change for the web planner.** `apps/web` is untouched — zero files changed, source
  and tests alike. `packages/ui` is untouched too (reuse boundary intact): every control on the new screen
  composes existing `@bombfarm/ui` primitives.

  Two known, recorded limitations ship with this feature rather than being silently claimed:
  `degraded` sections are implemented and unit-tested but currently unreachable end to end (the
  account-restore merge prefers a stale body over a degraded live read); and the manual
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
  gone.** `@bombfarm/domain` stopped modelling Abisso, Glass Cannon and Tempo Dobrado; this
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

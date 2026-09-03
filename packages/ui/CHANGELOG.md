# @bombfarm/ui

## 0.10.0

### Minor Changes

- 37fd673: Add the referral code to the desktop app, in the two shapes the support link already uses: a chip
  in the top bar beside the language toggle, and a labelled row in the Settings support section.
  Clicking either copies the code; when the clipboard is refused the code is selected in place and
  the app says so, so the click always leaves something to act on.

  The code itself moves to `@bombfarm/domain/referral`, which the web planner's topbar chip, footer
  line and first-run notice now read through as well. It had been a web-only constant, and this code
  does change — a desktop copy updated separately would eventually show a dead code that a player
  pastes and loses the reward on.

  `@bombfarm/ui` gains the `copy` icon and a `referral` button variant that both apps' controls can
  draw from.

### Patch Changes

- 006f970: Answer the question both apps could only half answer: what is this account actually worth?

  **A new figure — what this account could sell.** It adds up three things the market will take off
  your hands: the tradable items in your inventory, the heroes the game permits selling, and the bought
  skins your heroes are wearing. Each is broken out on its own line with its own count, so you can
  see at a glance that, say, forty of forty-three tradable items are priced and two of six sellable
  heroes are. It appears on the Account page of the web planner and on the desktop app's new Account
  screen, and it is the same computation on both — the two cannot disagree about the same inventory.

  Two things about that number are stated where you read it, because both would otherwise mislead.
  A hero listing is priced by rarity alone — level, gear and abilities count for nothing on the
  market — so the heroes line is a floor, never what a well built hero fetches. And a bought skin is
  an account-wide unlock: it counts once however many heroes wear it, and only while one of them
  still does, so dressing every hero back to a birth skin drops the figure with nothing sold.

  **It never guesses at a part it cannot see.** When one of the three cannot be read at all, that
  line says so instead of showing zero, and the heading changes to say the total covers only part of
  the account. A missing part is never quietly counted as nothing.

  **The desktop app has an Account screen.** It shows who the account belongs to and how far it has
  come, the House — its recovery cycle and how many heroes it refills at once, with the next House
  previewed at the level you get on unlocking it — the full skill tree as the game totals it, and
  the sell figure above. The tab sits between Inventory and Settings, so the nav now reads
  Live · Farm · Inventory · Account · Settings.

  **The inventory's own total is now named for what it is.** The header that read "Market value" on the
  Inventory screen of both apps now reads "What your inventory could sell". It was never the account's
  worth — it was always the inventory's, and now that the account has a figure of its own the old title
  was the wrong one on the wrong screen. The number itself is unchanged, and it is now taken from
  the same shared computation the Account screen uses.

  **On the web planner, heroes are counted only after a fresh import.** Whether a hero may be sold
  is something the game says in your save, and the planner has only just started carrying it. A
  roster imported before this change does not have that answer, so the heroes line is withheld —
  rather than reporting a whole roster as unsellable, which is what assuming an answer would do.
  Import a save again and the line fills in. The inventory and skins lines need no re-import.

## 0.9.1

### Patch Changes

- 4b6d4ba: Open a compact second Live window from the **Open mini** button in the app header or the tray
  **Mini** entry, once you have granted account access. Choose which panels appear, stack them or
  put them side by side from the gear menu, and pin the mini window always-on-top from Settings. The
  mini remembers its size, position and panel choices across restarts on the same display.

  Its hero rows show the name, rank and level, and mark whether each hero is on the field, resting,
  idle or benched. The window appears as soon as you click, showing a placeholder while it starts
  rather than waiting with nothing on screen.

- 652ab4a: The two always-on-top switches in Settings → Window drew on top of their own labels instead of
  sitting in the row's control column, hiding the start of each label and leaving the switch itself
  standing on end. A settings row places the label on the left and the control on the right, and the
  control is recognised by a marker it carries; the switch was the one control that carried none, so
  the row treated it as more label text. Both toggles now sit at the right of their row, and every
  control the design system offers is checked against that contract.

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

## 0.7.1

### Patch Changes

- af7bd8c: Optimize build now picks what it optimizes for, and the roster-wide reset banner is gone.

  A target select is glued to the **Optimize build** button on the Points tab. **DPS** is what the
  button always did — the best allocation the search found for that hero's sustained DPS. **Farm**
  searches the same points against your farming rotation's gold per hour instead: the whole
  rotation is scored, only the open hero's points move, and the result is reported in gold per hour
  rather than DPS. It is its own setting, independent of the Next point panel's ranking mode, so you
  can rank the next point one way while reallocating a whole build the other.

  The banner across the top of the planner that named every hero a reset might help is withdrawn. It
  restated, roster-wide, advice already carried for the hero you are looking at — the warn border on
  the hero strip and the gain line inside the Points panel, both of which stay. Those two now say
  that the gain they found is a sustained-DPS one, which an unqualified "possible gain" no longer
  settled once the button could also search for farm rate.

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

## 0.6.0

### Minor Changes

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

### Patch Changes

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

## 0.5.0

### Minor Changes

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

### Patch Changes

- dec4425: Dragging the window by its header no longer stutters or snaps back. The header carried a sticky
  position, a stacking context and a backdrop blur inherited from the web planner, none of which
  applies in a shell whose main region is the only thing that scrolls, and all of which put the
  header on its own compositing layer — the layer the OS drags once the header is the title bar.

  The header also now matches the caption strip beside it exactly, instead of sitting a shade
  darker than it.

  On the Live screen, the four field lists — on field, recovering, queued, benched — sit two to a
  row instead of four full-width rows, so the whole field reads without scrolling past whichever
  list is longest. They still stack on a narrow window.

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

## 0.4.0

### Minor Changes

- c8a3bc8: The Phases board's Economy panel was showing XP per prop straight from the wiki, with no account
  boost applied — every other "yours" figure on that panel (gold included) already scales with your
  account, XP just didn't. It now reads a wiki/yours pair, same as gold: "yours" is the wiki value
  times your account's XP multiplier (`skills.totals.xp_mult` from your save).

  There's also a new **Drops** panel on the Phases board, showing each drop chance the game's own
  tooltip shows at that phase — item/hero chest, ready key, time chest, gem chest, stone chest —
  each as a wiki/yours pair, filtered to only the drops that actually roll on that phase (a gate
  phase shows chest + time + gem + stone; a non-gate phase shows chest + key). "Yours" is the wiki
  rate times `(1 + your on-field squad's average luck)`, reconciled against two live in-game
  tooltips.

  The Account import summary now also shows your account's XP multiplier alongside the existing
  team-coin percentage.

  The Farm Ranking board's per-phase estimate had the same two gaps, in its own separate
  computation: its XP/hr column didn't carry your account's XP multiplier either, and it modelled
  four of the five drop kinds, with no stone-chest term. XP/hr now scales the same way gold/hr
  already does, and the estimate now also accounts for stone chests on gate phases, at the same
  rate as gem chests — not yet surfaced as its own board column.

- 37c30bf: Adds a shared `DeltaTable` primitive (`@bombfarm/ui`) — a Stat / Now / Target / Change ledger
  rendered as a real `<table>` — and moves the Team Plan hero breakdowns and the Farm Respec
  Advisor's per-hero card onto it, replacing two implementations that had drifted apart.

  The Farm Respec hero card picks up the fixes the Team Plan grid already had: digits now align
  (`tabular-nums`), the Change column is coloured by sign, and the columns hold a fixed width down
  every row via `table-layout: fixed` plus an explicit `<colgroup>` — so the Luck row's "kept"
  indicator (now a compact lock glyph with a tooltip, replacing a Chip + `HelpTip` pair) can no
  longer widen the label column or grow its own row taller than the rest. The card's columns are
  also reordered to match Team Plan's chronological now → target → change (previously target-first),
  and its blank label-column header now reads "Stat". `DeltaTable` computes the change column itself
  from `now`/`target` rather than accepting it as a separate input, so the two can never disagree
  again.

### Patch Changes

- ab1c1b9: Shows each drop's in-game chest next to its label in the phase **Drop chances** panel, drawn at
  the difficulty of the phase being viewed.

  The panel named five drops in text alone, and its rows came in wiki/yours pairs, so a gate phase
  printed eight nearly identical lines that differed only by wording and a three-decimal percentage.
  An icon is how players tell these apart in the game, and it is what makes a row findable without
  reading it. Those pairs are merged into one row each further down, which is what makes room to
  draw the art at a size worth reading.

  **Every row shows the chest the drop actually arrives in**, except the ready key — a key is not
  delivered in a chest, so that row shows the key itself. Four of the five are difficulty-scaled,
  matching the art the game files per band and the colour language players already read (green at
  Fácil through red at Inferno). The mapping is the game's own, not an invention:

  - `key` → the gate key of that band's rarity. The band→rarity step is the same `1..5` the planner
    already applies in `GATE_KEY_RARITY_INDEX`.
  - `time` → the House of that band. A time chest pays out house parts, so the game files its stash
    icon as the house itself rather than as a chest.
  - `stone` → the skill-stone chest of that band.
  - `gem` → the gem chest of that band.
  - `chest` → fixed, and deliberately so: an item chest's grade follows the MAP LEVEL it drops at,
    not the difficulty, so tinting it by band would assert a relationship the game does not have.
    It uses the neutral wooden sprite the game's own item-chest icon constant points at, which
    reads as "this one is not difficulty-scaled".

  `dropIconSrc(dropId, ato)` in `@bombfarm/domain`'s `wiki-assets` builds those paths, clamping an
  out-of-range or non-finite band rather than composing a path to nothing. A `DropIcon` component in
  the web planner's `game-art` set renders it inside the existing label cell, adding no row to the
  panel, and decorative (`alt=""`, `aria-hidden`) since the label remains the accessible text.

  `StatListItem` gains an optional **`icon`**, rendered as a sibling of the label rather than inside
  it. That distinction is the whole fix, and both halves of it were measured in the browser rather
  than assumed:

  - A label carrying a `tip` _becomes_ the tooltip trigger, so art folded into the label lands
    inside that trigger — taking the trigger's dotted underline under the sprite as well as the
    words, and widening the hover target past the text it belongs to.
  - Folded in, the rows also grew 31px → 35px. As a sibling of the label they took their pre-icon
    height back exactly. (The row merge below then grows them deliberately, to 47px, which is a
    different decision made for a different reason.)

  21 newly bundled sprites under `public/wiki-assets/` — four per-band families of five, plus the
  one fixed item chest. All but the gem chests are byte-identical mirrors of what the wiki serves at
  the same subpath, matching how the existing `env/` and `icons/` art is carried; the wiki does not
  publish gem-chest art in any form, so those five come from the game client, and the
  `WIKI_ASSETS_BASE` doc names that exception rather than leaving the directory's provenance
  overstated. A forward-only guard resolves all 21 paths through `dropIconSrc` and asserts each file
  is on disk — every band, not just one, because a per-band family can be correct at ato 1 and dead
  at ato 4.

  No drop math changed: the same wiki and yours figures are computed and formatted as before — the
  change is which of them a row leads with, and how many rows it takes to say it.

  **The wiki/yours row PAIRS are merged into one row per figure**, in both the Drops panel and
  Economy. Each row now leads with the boosted total and carries the wiki base and the boost that
  produced it as subtext — `0.117%` over `0.100% +17% sorte`. The pair stated both numbers but left
  the reader to divide one by the other to see the boost at all, and it cost two rows per figure:
  eight on a gate phase's Drops panel, differing only by a parenthesised word.

  - A row with no boost prints the bare total and no subtext. With no save imported every multiplier
    is 1, and `0.100% +0% luck` restates the total while implying a boost that is not there.
  - Economy's XP row merges on the same terms, so the panel does not mix both shapes, and its three
    gold rows move the coin from the value to the label — the coin marks what the ROW is about, so
    it belongs with the row's name. A new `GoldIcon` does that; `GoldValue` is untouched and still
    prefixes coins to inline figures in the four other surfaces that use it.
  - The merge is what pays for `size-8` (32px) drop art, up from 14px. A gate phase prints four rows
    where it printed eight, and the panel's height comes from the board grid rather than its
    content. Measured: rows go to 47px, the list fills 181px of the panel's 405px, and the panel
    does not move. The taller row also absorbs the subtext line for free.

  Every merged label drops its `(wiki)`/`(yours)` suffix, so ten drop keys and eight economy keys are
  replaced by nine single-label keys plus three naming the boost SOURCE (`luck`, `team coin`,
  `XP mult`). `phasesXpPerProp` is revived at the frozen fixture's own value, so it leaves
  `KEYS_REMOVED` rather than becoming a declared delta.

  The account-486 live-tooltip witness is preserved through the change rather than relaxed: the
  tests read the two lines back out of the value node and still assert `167 -> 261` and `194 -> 303`
  for XP, and the four gate drop totals, as numbers.

  **The bundled drop sprites are renamed on the way in, to English difficulty words.** Upstream
  files the five bands inconsistently — bare indices on some families (`chest_skill_1`…`_5`,
  `house_house_1`…`_5`) and Portuguese words on others, two of them misspelled (`dificio`,
  `muitodificio`, for _difícil_ / _muito difícil_). Neither form belongs in this tree: an index
  leaves a reader decoding `_4`, and the misspellings would carry another project's typos into a
  public repository. They are now `chests/gem_chest_very_hard.png`,
  `chests/skill_stone_chest_easy.png`, `houses/house_inferno.png` and so on, off one
  `DIFFICULTY_SLUG` table taken from `GAME_DIFFICULTY_EN`. The meaningless `steam/` directory and
  the doubled `house_house` are gone with it, and `icons/chest_0.png` is now `chests/item_chest.png`.

  Renaming costs the property that a local path tells you where the file came from, so
  `docs/bundled-art-provenance.md` records the upstream path for each one — that table, not the
  directory listing, is what a refresh has to be driven from. The guard sweeps all 21 paths across
  every band, and is sharper than the equivalent prop sweep for the same reason: these names are
  this repo's own, so nothing upstream would ever disagree with a typo in one.

  Gate keys are deliberately left filed by rarity (`key/key_mythic.png`, not `key_inferno`): the art
  IS the rarity's key, and the band→rarity step belongs in `GATE_KEY_RARITY_INDEX` where it is
  visible, not buried in a filename.

  **The boost tooltip moves off the label and onto the subtext, and the drop-chance breakdown gains
  its missing skill-tree term.** Two follow-on fixes to the merged row above:

  - The label stopped being the tooltip trigger. With the boosted total and its breakdown already
    printed on the row, hovering the plain word "Item chest" to learn what boosted it was one
    interaction too many — the arithmetic is the thing worth explaining, so the dotted underline
    moves onto the subtext line itself (`TipLabel` now wraps the subtext, not the label). The three
    now-unused `phasesBoost*` strings (`luck`/`team coin`/`XP mult`) are removed with it — the
    trailing source word they supplied is gone from the subtext, which now reads `167 + 56%` and
    `0.100% + 17%` rather than `167 +56% mult. XP`. The three surviving hint strings say "base
    value" in place of "Wiki": the merged row already prints the wiki number inline, so naming it a
    second time in the tooltip was the confusing name, not the helpful one.
  - **Drop chances decompose into base + skill-tree Sorte + squad Sorte**, in that order, matching
    the order the tooltip explains them in — `0.100% + 20% + 5%`. `farm-rate.ts` already tracks
    these as two separate quantities (`treeLuckFlatPct` and the uptime-weighted `heroLuckPct`,
    peeled apart specifically so the tree's flat add is never double-counted); `phase-intel.ts`
    previously only accepted the pre-collapsed sum. `PhaseIntelGlobalOptions` gains
    `treeLuckFlatPct`/`squadLuckPct` as pure DISPLAY echoes — they do not feed `dropChances[].actual`,
    which stays driven by `luckFraction` alone, so every existing caller and the account-486 witness
    keep working unchanged. `phases-explorer.tsx` derives `squadLuckPct` as
    `luckFraction * 100 - treeLuckFlatPct` rather than re-averaging independently, so the two terms
    sum to the combined figure by construction. `dropItems` falls back to a single combined term
    when a caller does not supply the split (both default to `0`), rather than inventing a two-way
    divide it was never given — this is the path the account-486 witness test still exercises,
    since that witness only ever measured the two heroes' combined average, not a tree/squad
    breakdown.

  Gold and XP get the same subtext-tooltip treatment but **stay single-term** — `167 + 56%`, not a
  fabricated split. Both were checked against `farm-rate.ts` before assuming a squad share existed:
  `teamCoinMult` and `xpMult` are read straight off `account.tree` with no per-hero averaging
  anywhere in the pipeline, so the model genuinely has only one contributing source for either
  figure. `avgGold`/`mapGold` gain a tooltip they never had (`phasesGoldActualHint`, same as the
  `gold` row they share their math with) as a small, deliberate side effect of unifying every
  boosted row on the same subtext-tooltip shape rather than keeping one row an exception.

  **The English Drop-chances hint said "Sorte" instead of "luck".** The drop-chance boost
  breakdown above shipped with `phasesDropActualHint`'s EN copy reading "your skill tree's Sorte" —
  Portuguese leaking into the English namespace block, against this repo's own established
  convention (`stats.ts`'s `luck: "Luck"`, `gear.ts`'s `sorte: "Luck"`). Reworded to "your skill
  tree's luck" / "your squad's average luck"; the PT block, which correctly says "Sorte", is
  untouched. Four code comments in `phases-explorer.tsx` and `phase-fact-items.tsx` that said
  "Sorte" in prose are aligned to "luck" for the same reason, at no material cost to the diff.

  **The Drops panel always shows all five drop rows now, marked by phase type, instead of hiding
  the ones that cannot roll here.** A gate phase used to print 4 rows and a normal phase 2 — a
  reader comparing two phases side by side saw a different-shaped panel each time, and the layout
  math (`docs/`, `panel-field.recipe.ts`) never accounted for a row COUNT that could grow again
  later. Every row is now emitted in the fixed `chest, key, time, gem, stone` order regardless of
  phase type; a row that cannot roll on the phase being viewed is dimmed (`StatListItem` gains an
  optional `muted`, rendered as `opacity-45` on the row) and its value replaced by a dash plus a
  small note naming which phase type it IS specific to (`phasesDropGateOnly` for the three
  gate-only chests, `phasesDropNonGateOnly` for the ready key) rather than a live percentage.

  That last choice — dash, not a computed number — is deliberate: `row.actual` is still a real
  number for a drop that cannot roll here (the domain math does not gate it), but printing it next
  to a chest icon reads as "this can happen," which is false. A dash next to a dimmed, marked row
  reads as "not here" without inventing new UI vocabulary. `dropAppliesOnPhase` in
  `packages/domain/src/phase-wiki.ts` remains the one place that decides gate vs. non-gate; the
  panel only reads `DropChanceRow.applies`, never re-derives it.

  Measured in the browser on both phase types (map 1-1, non-gate, and map 1-10, a gate): the row
  count is 5 either way, the row list is 228px tall (was 181px at 4 rows), and the panel itself
  stays at 404.8px — byte-identical between the two phases and unchanged from before this PR, since
  its height still comes from the board grid rather than its content.

  **Final copy pass.** The key row is labelled just "Key" / "Chave" — "Ready key" carried the game's
  internal `keyDropRate` phrasing into the UI, where the qualifier says nothing a player needs. And
  the gate/non-gate sentence moves out of the per-row boost tooltip into the panel's section
  description: it describes the whole panel rather than any one row's arithmetic, so repeating it in
  every row's tooltip made the tooltip say two unrelated things and hid a panel-level fact behind a
  hover. It uses the same `tipClass` the Hero panel's section description already uses.

- 387f85c: Reworks the Farm Ranking board's rotation pool row and filter placement.

  Each rotation pool chip now shows the hero's identity — avatar, rank, name, rarity and level —
  via the shared `HeroIdentityChip`, instead of a bare truncated name next to a switch. The chip
  uses a new `stacked` variant that pins it to three lines (rank+name / rarity / level) and omits
  the record id, so a grid of chips keeps one uniform height; the enable switch sits on the right
  edge of the chip. A disabled hero's identity dims and desaturates so the toggled-off state reads
  clearly beyond the switch alone.

  The unlocked/difficulty/gate filters and the return bonus picker move from the top of
  the panel down to sit directly above the ranking table (and above the "no phases match" empty
  state, so a fully-filtered board still exposes the controls needed to undo it), separated from
  the respec toolbar above by a thin divider. Those fields now share a fixed label and control
  height, so their labels and controls no longer sit on ragged baselines when one field carries a
  help tip and its neighbours are taller selects.

  A further pass over the same board:

  - Removed the FEASIBLE column and the "Feasible only" filter switch from the UI. The underlying
    `infeasible` row field and its domain computation are untouched — only the board's own column
    and filter went away.
  - The difficulty filter now lists the in-game difficulty names (Easy / Normal / Hard / Very Hard
    / Inferno, localised) instead of the bare numbers 1-5.
  - The "Show ranking under this build" re-rank toggle now only appears once Optimize has produced
    a fresh proposed build, instead of being always mounted above the table.
  - The Phase column and the respec headline now print the in-game coordinate — `Normal 1-1 (#51)`
    — instead of the wiki flavour name, so the board reads the same way the in-game map picker does.
  - The Mitigation column now prints its `%` sign.

  A fourth pass, focused on the table's overall fit and readability:

  - The Gold, Item chest, Key, Gem chest and Time chest columns now carry the matching in-game
    icon at a readable size (the same `size-8` art the Drops panel already uses), all drawn from
    the Inferno/mythic band. The Chests/Keys/Gems/Time pieces headers are reworded to the Drops
    panel's own chest-equivalent vocabulary ("Item chest", "Key", "Gem chest", "Time chest") instead
    of naming the loose resource.
  - Every rate column header drops its "/hr" suffix; each cell now states its own unit instead
    ("949.8k/h", "+6.0/h" for the signed keys column).
  - The Cage window column is removed from the table entirely — the underlying early-arrival cap
    and guaranteed window are unchanged and still shown on the Phase explorer's own Cage panel.
  - These three changes together let the table fit within a typical desktop viewport without a
    horizontal scrollbar; the table's minimum width drops from 93rem to 77rem.
  - The table header now stays pinned while only the row body scrolls underneath it, both on a tall
    row set and on a narrow viewport that still needs to scroll horizontally.

  A fifth pass, on the same five icon headers:

  - The Gold, Item chest, Key, Gem chest and Time chest headers now show only the sprite, on one
    line — the label that used to sit under it (stacking every header into two tiers) survives as
    screen-reader-only text and as a hover tooltip on the sprite instead. Sort chevrons, `aria-sort`
    and the sort announcement are unaffected.
  - Column widths are retuned now that those five headers no longer need to fit a word under the
    icon: the table's minimum width drops from 77rem to 68rem, closing the horizontal scrollbar
    that a 1280px-wide viewport used to show.

  A sixth pass, on the row's own gate marker and its resource columns:

  - The Key column's cell no longer prints a trailing "consumed" annotation on gate rows — it reads
    the signed rate alone (e.g. `-15.5/h`), the same shape a non-gate row's gain already has. This
    also frees width the annotation used to reserve, so the table's minimum width drops from 68rem to
    66.5rem.
  - The row's "Gate" chip is replaced by the game's own gate-timer clock icon, with the same word
    carried as a hover tooltip and as always-present screen-reader-only text — the marker stays
    mounted on every row (only visually hidden on non-gate ones), so no row height changes.
  - The Gem chest and Time chest cells now dim and print an em dash on non-gate rows, matching the
    Drops panel's existing treatment of a figure that cannot roll on the phase being viewed — those
    two chests only ever drop on a gate. The Item chest, Gold, XP and Key cells are unaffected: the
    first three always apply, and the Key cell states a real net rate on every row.

  A seventh pass, trimming row height:

  - The "Push target" badge on locked phases is withdrawn for now. It sat beside the phase label and
    wrapped onto a second line, growing every row it appeared on; the unlocked-only filter remains the
    way to include or exclude locked phases.
  - The Gold column's header coin is sized down a step so it reads at the same visual weight as the
    four chest sprites beside it.

  An eighth pass, virtualizing the row body:

  - The table body now mounts only the rows scrolled into view (plus a small overscan band), instead
    of every row the current filters match. Turning off "unlocked only" used to mount all 600 phase
    rows at once — a measured ~150ms hitch on that click, and every row stayed a `content-visibility:
auto` DOM node even offscreen, which is also the likely cause of the scrollbar/scroll-position
    oddities that property is known to cause. Expanding to 600 rows now mounts under 30 and lands
    under 20ms.
  - `aria-rowcount` on the table and `aria-rowindex` on each row now state the full filtered row
    count and each row's position within it — the same "no row was silently dropped by a filter"
    guarantee a full DOM row count used to prove, expressed in a form that still holds once only a
    window of rows is mounted.
  - Every body row now carries an explicit, CSS-enforced height (33px — the row's real rendered
    height, not the 44px the row's earlier `rowHeight` value assumed) instead of an unconstrained
    one, so the scroll math, the spacer rows and the scrollbar all agree with what is actually on
    screen; the visible row count feeding the window itself scales off that same real height so the
    table keeps its current visible density (about 19 rows) rather than the ~14 the old, wrong
    assumption implied.

- 37c30bf: An untouched stat row in the change tables is dimmed with the muted text colour instead of a
  flat opacity, which keeps it readable against the WCAG AA contrast floor. The Payback label
  matches the uppercase of the tiles beside it, and the advisor no longer carries a "this build
  earns less gold" message that a gold-only optimizer can never produce.
- 37c30bf: Reworks the Farm Respec Advisor's metric tile row.

  The Gold/hr and Chests/hr tiles now carry the game's own coin and chest icons beside their
  labels, and each one's `current → proposed` value carries its own signed percent change alongside
  it (e.g. "171,081 → 180,075 (+5.3%)") — `@bombfarm/domain` exposes this as two new signed fields,
  `goldGainPct` and `chestsGainPct`, on `FarmRespecResult`. Unlike the existing `gainPct` (the
  active objective's value, clamped `>= 0`), these two are deliberately unclamped: whichever
  currency is not being optimized can legitimately fall, and a clamped-to-zero percent would
  contradict the tile's own "gives up N gold/hr for this objective" note sitting right next to it.

  A new "Phase" tile sits between the rate tiles and the cost/payback tiles, showing the recommended
  phase to farm before and after the proposed respec (`Easy 3-7 (#27) → Normal 1-1 (#51)`), so the
  phase change driving the gold/chest numbers is visible without leaving the panel. When the
  proposal does not move the phase, the tile shows the phase once plus a small "(same phase)" note
  instead of printing the identical label twice. The tile row now spans 2/3/5 columns at
  mobile/tablet/desktop widths to fit the fifth tile.

  The Payback tile's label is now itself the tooltip trigger (a dotted underline, matching
  `@bombfarm/ui`'s existing `StatList` glossary-term idiom) explaining what the figure actually
  divides — the respec cost by the _increase_ in gold/hr the new build earns, not the new rate on
  its own — after players misread "pays for itself in 0.3 h" as computed against the new gold/hr
  alone. `@bombfarm/ui` exports its existing `TipLabel` primitive from the barrel for this.

  `@bombfarm/domain` also adds `chestIconSrc()` next to the existing `goldIconSrc()`, sourcing the
  same sprite `dropIconSrc('chest', ato)` already used for the neutral, difficulty-independent
  item-chest icon.

- 387f85c: Fixes the sortable DataTable column header's hover so it fills the whole header cell instead of
  a smaller inset box — most visible on headers taller than their own label, like Farm Ranking's
  sprite-icon columns, where the fill used to stop partway down the cell leaving an unfilled band.

  The hover is also restyled for the theme: a full-cell accent wash, the label lifting from muted
  to ink, and a crisp accent rule along the cell's bottom edge as a sort affordance, gated by
  `motion-safe`. Hover stays visually secondary to the active/sorted column, which still carries
  its own persistent accent-colored label and direction chevron regardless of hover. The
  keyboard focus ring now also spans the full cell rather than the button's own smaller box.

  Glossary terms get their keyboard focus ring back. It was written with the bare `outline`
  utility next to `outline-2`, which tailwind-merge treats as one conflict group, so the pair
  collapsed and left the outline style unset.

  The Phases panels now name rarities in English in the English locale. They printed the
  Portuguese names ("Comum", "Incomum", …) regardless of language, unlike every other surface.
  The phase Gold row's label follows: "Gold (Common)" rather than "Gold (Comum)" — Comum is the
  rarity tier the base figure is quoted at, which every other prop scales up from.

## 0.3.0

### Minor Changes

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

## 0.2.0

### Minor Changes

- dc82f15: `AppShell` grows into a sidebar nav + content area + status bar (data-driven `items`, controlled `activeId`/`onNavigate`; an empty/omitted `items` renders no nav rail). Adds `StatusChip`, the single implementation of the game-connection states (connected / not running / stale, with an optional age label), and `EmptyState` for "no game / no items / no filter matches" placeholders. The sidebar collapses to icons-only below the `compact` breakpoint; collapsed labels stay in the accessibility tree.

  The desktop renderer adopts all three: its hand-rolled `formatStatus`/`statusClass` helpers and hardcoded `emerald`/`amber`/`--bf-*` classes are gone in favor of `StatusChip` and token-based chrome, and the "preload bridge unavailable" / "no snapshot yet" states now render through `EmptyState`.

- dc82f15: Adds the toast system DESIGN_SYSTEM.md §11 specifies: a pure, node-testable queue reducer (`toast-queue.ts`) implementing key-based coalescing, a 3-visible/"+N more" overflow stack, severity-dependent auto-dismiss, and threshold-gated progress announcements, plus `ToastProvider`/`useToast`/`ToastViewport`/`ToastItem` built on a plain portal (base-ui's `Toast` couples every rendered toast to its own internal store and timers, which would fight this feature's single-source-of-truth reducer — see `design.md`'s T1 finding). Also adds `NotificationCenter` (a controlled ring-buffer view), `Slider` (a `@base-ui/react/slider` wrap), and the `SettingsSection`/`SettingsRow`/`SaveBar` settings-form primitives.

  The legacy `Toast` stays byte-compatible for `apps/web`'s planner and now carries a `@deprecated` JSDoc pointing at `useToast`. `toast.recipe.ts` is untouched.

### Patch Changes

- dc82f15: Storybook ownership moves from `apps/web` (`@storybook/nextjs`) to `packages/ui`
  (`@storybook/react-vite`) — the catalog now lives with the package it documents.
  Fonts are self-hosted via `@fontsource` instead of `next/font/google`. Adds
  `@storybook/addon-a11y` and a `@storybook/test-runner` gate (`pnpm --filter
@bombfarm/ui test-storybook`) that smoke-renders every story and asserts zero
  accessibility violations, wired into CI on the existing `web` path filter.

  Fixing the a11y violations the new gate found touches a few components' visible
  chrome: `Banner` now renders a `<div role="status">` instead of `<aside
role="status">` (an `<aside>`'s implicit landmark role doesn't permit overriding to
  `status`); the "warn" chip/`StatusChip` tone and `AbilityCard`'s locked-out dimming
  and `Panel`'s unverified dimming are all slightly lighter, raised to clear WCAG AA
  contrast; `FileDropZone`'s inner "Choose file" control is no longer a second
  keyboard tab stop (it was decorative — the drop zone's own `role="button"` wrapper
  already handled activation).

  `apps/web` no longer hosts or depends on Storybook.

- dc82f15: Housekeeping after the Storybook move, no runtime behaviour change. `apps/web`'s
  TypeScript config no longer includes the deleted local `.storybook/` directory, and
  root ESLint now lints `packages/ui` story files (with type checking off, since they
  sit outside the package tsconfig) so the raw `react-icons` / `*.svg` import ban that
  guards the `Icon` seam applies to stories too, not just to product code.

## 0.1.0

### Minor Changes

- d2116e5: Add the `Icon` seam to `@bombfarm/ui`: closed `IconName` union over a UI-chrome registry (`react-icons`), design-system migrations, Storybook gallery, and lint enforcement. Game glyphs are out of scope.

### Patch Changes

- 6ca8b4a: Centralize design tokens in `@bombfarm/ui` (M2): shared `@theme`, typed mirror, WCAG contrast tests, and unified web/desktop palette.

# @bombfarm/hero

## 0.2.0

### Minor Changes

- b0f4431: Say each combat figure once, and stop drawing three sections that could never fill.

  **A hero's field time was reported as 4.495,4%.** `uptime` is already a percentage — field seconds
  over field plus rest, times 100 — and the combat panel multiplied it by 100 again. A hero on field
  45% of the time read `4.495,4`. It reads `45,0` now, and this was wrong on the phase explorer too.

  **The Combat stage stated eight figures twice.** Damage through, normal hit, critical hit, field
  time, fuse, uptime and both DPS figures appeared bare in the hero panel and again, each with the
  ledger that produced it, in the breakdown below. The bare copy is gone: it was the same number
  with less behind it. What the hero panel still says is what only it says — whether the hero
  pierces the phase, the average hit its build lands, the floor its fuse cannot go under, the
  ceiling its cooldown reduction stops paying at, and the prop table.

  **Three empty sections, on any screen that cannot fill them.** A gear comparison needs a second
  loadout, which only a Copy gear button can create, so a read-only screen drew a heading over
  nothing. The Points panel held a blank line open for reset advice that names a button that screen
  does not have. Both now appear only where something can fill them — as the Preview column already
  does. The advice line still holds its space on the planner, where it comes and goes.

  **The stat sheet puts its units on the figures**, like the Points table beside it: `1.680,00%`
  under a row named `Crít`, not `1.680,00` under `Crít %`. The team-plan breakdown keeps the unit on
  the label, because its table formats its own numbers and has nowhere to put one.

- 579684a: A Combat tab on the planner, and one phase picker for it on both apps.

  **The planner has the desktop app's fourth stage now.** Hero, Combat, Gear, Points — the same
  four the desktop Heroes screen draws, from the same implementations. Combat holds the phase the
  figures are for, one hero against that phase (whether it pierces the mitigation, the average hit,
  the fuse floor, the cooldown-reduction ceiling, the prop table), and the per-statistic breakdown,
  which moves here from the bottom of Points. Picking a phase on it moves every figure the planner
  prints — the hero strip, Gear and Points read the same numbers — and leaves the Farm page's own
  selection alone.

  **The phase picker is the optimizer's.** Type `Hard 1-1`, `Normal 2-1` or `151` and pick the
  phase, on the desktop as on the planner, instead of stepping a number box. The button beside it
  reads **Back to your current phase** and stands as tall as the picker.

- 306d2d0: Paint each band of the grade scale in the colour the game prints that grade in, so the six read
  left to right as the ladder they are, with the hero's own grade lifted out of them.

  The abilities panel keeps one figure — how much of the point budget is spent — in place of the
  slot count, the granted-against-spendable split and the dead-point total. Points a hero can never
  spend are a consequence of its level and rarity, not something it can act on, so the panel no
  longer spends four rows saying so.

- 306d2d0: Lay the hero identity panel out as a band of facts over full-width detail.

  Rarity, grade, level, power, roll quality, market value and marketability were a narrow column of label/value rows sitting beside a much taller birth-roll section, and the birth roll then split again — a rail on one side, the eight-row table on the other. Two short things beside two tall ones left most of the panel empty at any width that had room to show more.

  They are now small tiles across the top, beside the hero's portrait and name, wrapping to fewer per row as the panel narrows. The grade rail and the roll table each take the full width beneath. The rail is the reason: each grade boundary is a band, not a line, because the measurement locates it inside an interval and no closer — and at half width those bands were too narrow to read as intervals at all.

- 306d2d0: Show the power the save recorded for a hero on its identity panel, grouped the same way the roster picker's power column groups it.

  The figure was already imported and already stored; the one screen dedicated to who a hero is was the only place that never printed it, so comparing two heroes meant leaving the panel for the picker.

  A hero nobody has imported a power for reads as an em dash, not as zero. Absence means the figure was never read, which is a different fact from a hero of no power — and a zero would sort and read as the worst hero on the roster.

- b0f4431: Show a hero's abilities beside its identity, and give the desktop hero screen the planner's stages.

  **The ability pool now sits under the portrait.** The identity panel's left column holds the
  portrait, name and stars with the pool below them — each ability's icon and its level out of 20,
  nothing else. Which abilities a hero owns and how far each is levelled is the first thing you check
  about a hero, and until now it meant scrolling past the birth roll to reach the abilities panel.
  That panel is unchanged and still the place that says what each ability does, what its next level
  is worth, and — in the planner — spends the point. A hero with no pool draws no strip.

  **The desktop hero screen is four stages instead of one long column.** Hero, Combat, Gear and
  Points, where the column used to run identity → phase → combat → abilities → next point → points →
  sheet → items → effective stats without a break. Hero, Gear and Points hold what the planner's tabs
  of those names hold, panel for panel, so the two apps read the same way; Combat is the fourth
  because this screen computes the phase-scoped figures the planner folds into its hero strip, and
  it carries the phase control beside them. Points also picks up the planner's own arrangement: the
  points table and the next-point ranking side by side, then the stat sheet, then the breakdown.

- b0f4431: Read a hero's market value on Steam, and say what unit each figure is in.

  **The market value is a link to the listing it was read off.** The tile carries the Steam mark and
  opens the Community Market page for that rarity — in the browser on both apps. A price this app
  quotes from a market it does not own is worth more when you can go and check it.

  **Each figure carries its own unit, and each name stops carrying one.** The Points table prints
  `45,45%` where it printed `45,45`, so the four rate stats are named `Crit` rather than `Crit %`.
  The stat sheet and the team-plan breakdown, whose rows show many figures at once, keep the unit on
  the name instead — one mark per row rather than nine. In pt-BR the column is `Atributo`, and the
  Effective stats panel is `Atributos efetivos`, matching the labels beneath them; English still
  calls a stat a stat.

  **The Preview column only appears where something can fill it.** It shows what the Optimize build
  search proposes, so on a screen with no search to run it was a permanently empty column taking
  width from the figures beside it.

  **Two things the sheet no longer says.** The desktop's sheet note said the breakdown came from
  your save; it reads the running game, and now says so. And a birth roll that lands near a grade
  boundary no longer prints a caveat about it — it is still a placement, and the sentence changed
  nothing a player would do.

  Descenders are no longer clipped off the identity panel's values: a truncated line at a line
  height of 1 cuts the tail off a `g`.

- 306d2d0: Name the planner's first tab for the hero rather than for one of the panels inside it, now that
  it carries identity and the birth roll as well as abilities.

  The birth-roll readout drops the distance-to-next-grade line, spaces the band's ends so a range
  reads as one span, and explains the roll-quality figure on hover — it is the average of the eight
  percentiles, which nothing on screen said. The grade rail carries a wash of the colour the game
  prints that grade in. The market tile answers with a price or with not-marketable: "sellable,
  amount unknown" told a player nothing they could act on.

- 306d2d0: Show a hero's stat sheet, its items and its best next stat point on the Heroes screen.

  **The whole reference half of a hero's detail is on the desktop now.** Under the combat and
  abilities panels the screen already drew, it adds what to spend your next stat point on, the points
  this hero has placed, the stat sheet peeled apart from the birth roll through level, stars,
  abilities, gear, points and skill tree, everything the hero is wearing with each slot's
  contribution and the totals, and finally where each combat figure came from — an expandable row per
  number, showing either the running ledger that builds it or the formula it is substituted into.

  **It reads your account and changes nothing.** Every one of those panels can be edited elsewhere;
  here none of them is. No stat steppers, no Reset, no Optimize build, no item editor, and the gear
  comparison shows the figures with nothing that could rewrite either loadout. The one control on the
  whole half is the target the next-point ranking is read against.

  **Ranking for farming says why it cannot answer, instead of going blank.** That ranking is scored
  against a farming rotation, which this screen does not compose — so asking for it keeps the damage
  ranking on screen and says plainly that there is no rotation to rank against, rather than showing
  an empty list that reads as "nothing is worth a point".

  **Both languages, from one place.** All 125 of these labels, headings and notes now ship with the
  panels themselves in English and Brazilian Portuguese, so the desktop and the web planner cannot
  drift into saying different things about the same number.

- 306d2d0: One Abilities panel in the planner's Hero tab, not two.

  The tab carried an editor — rank steppers and Reset — and, below it, a second panel under the same heading reporting the same hero's slots, points, dead points and what one more level of each ability is worth. Two panels, one subject, and a reader had to notice they were not the same thing.

  They are now one. The panel is the one the desktop already draws, and it takes the editing callbacks as an option: given them it carries the steppers and the Reset button the tab always had, and without them — which is what the desktop passes — the same figures render with nothing to click. Stepping, clamping and the disabled states are unchanged.

  Two figures now read in the desktop's wording rather than the planner's: slots as "2 of 3 for this rarity" and points as "14 of 40 spent". Points granted against points spendable stays, and the dead-point line is now always a stated sentence — a hero wasting nothing says so, instead of hiding a warning that does not apply to it.

- 61ee478: Move the roster rail, the card board and the toolbar that governs them into `@bombfarm/hero`, so
  the web planner draws the same three the Heroes screen does instead of a second copy. Two screens
  drawn twice is a hazard this repo already carries once and did not need again: the pair would have
  to be changed together, and nothing would say so when one of them was not.

  They take their strings as a prop, like every other panel in this package, against a
  `RosterBoardCopy` contract the host satisfies from its own dictionary — which is what lets the two
  apps use their own words for the same flag, where this one calls a hero out of the rotation
  inactive and the planner calls it disabled. The layout switch moved inside the toolbar rather than
  sitting beside it, so the fourth thing you can ask of a roster is not placed differently by each
  host. Nothing on the Heroes screen changes to look at.

  The ordering, the filtering and the list-versus-board rule move with them, tests and all, and the
  card keeps the explicit `memo()` it was already written with — the React Compiler does not run
  over a package a host transpiles, so a component that reaches a host that way keeps only the
  memoisation its own source spells.

  Fixes an ability tile no hero on the roster owns being pressable. It is drawn dimmed and marked
  unavailable, but the design-system tooltip drops a `disabled` attribute from its trigger on
  purpose — a disabled element receives no hover, and the tooltip naming the ability is the whole
  reason an unowned ability is shown at all — so nothing was refusing the press. Selecting one
  filtered the roster down to no heroes, with the same dimmed tile as the only way back.

- 5dffa73: Price team auras one way on every screen, and give a hero's own screen its switches.

  **The same hero printed a different DPS on every screen, and a different one on every account
  read.** The Heroes screen and the planner's Combat tab priced team auras off a snapshot of
  whoever happened to be standing on the field when the account was read, so the number moved as
  the rotation turned — on one real roster it read 22–33% low for every hero, on another 4.7% high.
  The Optimizer's damage objective summed each carrier's rank by its duty and clamped afterwards,
  which held two part-time carriers of one capped aura at the cap the whole time; the gold
  objective and the Farm board took the expected value of the capped sum instead.

  **Every screen that rotates a roster now prices auras the Farm board's way**: each carrier the
  game will field, weighted by the uptime the model predicts for it, the cap taken inside the
  expectation. The Optimizer's damage objective moves onto it — on a roster with one carrier per
  aura nothing changes; three Fôlego carriers that summed to 60 against a cap of 20 move a plan's
  DPS by −3.7% — and, like the gold objective, it now counts a hero you leave alone: that hero
  still fields, so its aura reaches the rest of the roster at the duty its untouched build sustains.
  Only a donated hero is out, on both. The phase explorer beside the Farm board prices the same
  way, on both apps, so it and the board agree.

  **A hero's own screen asks a narrower question, and gets a control.** The Heroes screen and the
  Combat tab price one hero on the field: its own aura always counts, and every other carrier is a
  what-if behind a switch — off, the hero is priced alone; on, that aura counts every other hero in
  rotation that carries it, as if they stood on the field the whole time. The four switches sit
  beside the phase picker, say what they assume, and say where the uptime-weighted figures live
  instead. They reset on every visit, like the phase pick.

  **The stored aura total is gone.** The planner used to keep a hand-typed override that no screen
  has offered a field for since August, and a snapshot that went stale on the next read; a saved
  account still carrying either loads with both discarded. A Farm board that was still being priced
  against such an override — a number no control could show or clear — now prices the roster like
  every other.

### Patch Changes

- 30428ba: Price every DPS figure on one bombing-cadence model — the Farm page's measured one — and retire
  the advisor's serial model.

  **Two models printed DPS.** The hero strip, the Points ranking, the reset-advice gate, the Combat
  stage on both apps and the Optimizer's damage objective read a serial cycle, `1 / (fuse + 0.15 s)`,
  in which Speed did not appear: a Speed point ranked at 0% forever and Marcha Acelerada was worth
  nothing. The Farm page read a measured cycle — the longer of the fuse and the walk to the next
  plant, averaged over hop lengths measured in real clears and packed closer on denser difficulties
  — so a hero's bombs per second on the Combat stage and its plants per second on the Farm page, at
  the same phase, were two different numbers.

  **Now there is one.** The advisor's bombs per second is the inverse of the Farm page's cycle at
  the farm phase's own difficulty band. Speed shortens every hop the fuse does not already cover,
  and is a real next-point candidate (about 1.1% a point on a typical hero). Cooldown reduction pays
  only on the hops where the fuse is the longer leg — observed directly: a hero that reaches its
  next target before its previous bomb has gone off waits on the cell and plants a fifth of a
  second after the fuse ends, and when one hero was respecced from 12% to 28% cooldown reduction
  that waiting time moved with her fuse, one for one, while a second hero's did not. Where the
  crossover falls depends on walk speed and on the field; the model puts it near 53% for a hero
  walking two cells a second, and past it the point scores zero, where the serial model had it
  paying through to the 80% cap. Nothing is measured past 28%, and the same capture found the model
  overstating how much of a fast hero's field is fuse-bound, so a fast hero's cooldown figure reads
  high rather than low. A build with every point in cooldown still trips the reset gate — harder
  than before.

  **Every DPS figure moves, on both apps**, typically down by about a third at mid cooldown
  reduction; the Bombs/s breakdown prints the one formula with the fuse, walk speed, band and
  resulting cycle substituted, and the "How the math works" text describes the measured cycle.

  **The accepted cost:** the measured cycle's approximations — a hop histogram fitted at one
  difficulty band and scaled to the others, a density term that runs optimistic at the easiest band,
  latency constants calibrated on squad clears — now reach per-hero figures. Those are errors of
  degree; Speed doing nothing was an error of kind. A hero priced alone is priced at squad density,
  as the Farm page already priced it.

- 843027d: Stop sending the reader to an Account "Team buffs" control that no screen draws.

  Four planner strings — the abilities tip, two paragraphs of How the math works and the Optimizer's aura disclosure — still said to set another hero's War Cry under "Team buffs" on the Account page. No page has had that control for a while, so a player checking why in-game damage diverged from the model was told to open a panel that does not exist. The same paragraph also described a "Use as farm phase" button that is gone: the phase every combat figure is computed at is the one the Farm page is set to, unless the Combat tab is looking at another.

  Those strings now point at the Combat tab, where each team aura has its own switch, and they say "team aura" — the term the app uses everywhere else — instead of "team buff", which the rest of the explain text, the Effective-stats tip and the breakdown's source label now also use, on the planner and on the desktop Heroes screen alike.

- Updated dependencies [306d2d0]
- Updated dependencies [579684a]
- Updated dependencies [16c218d]
- Updated dependencies [306d2d0]
- Updated dependencies [b0f4431]
- Updated dependencies [b0f4431]
- Updated dependencies [306d2d0]
- Updated dependencies [306d2d0]
- Updated dependencies [306d2d0]
- Updated dependencies [047ce89]
- Updated dependencies [30428ba]
- Updated dependencies [fcc507e]
- Updated dependencies [306d2d0]
- Updated dependencies [6fe7247]
- Updated dependencies [5dffa73]
  - @bombfarm/domain@1.1.0
  - @bombfarm/ui@0.12.2
  - @bombfarm/game-art@0.5.0

## 0.1.3

### Patch Changes

- Updated dependencies [f3a35b8]
  - @bombfarm/ui@0.12.1
  - @bombfarm/domain@1.0.1
  - @bombfarm/game-art@0.4.2

## 0.1.2

### Patch Changes

- Updated dependencies [ae89de0]
- Updated dependencies [ae89de0]
- Updated dependencies [ae89de0]
- Updated dependencies [ae89de0]
- Updated dependencies [ae89de0]
- Updated dependencies [ae89de0]
- Updated dependencies [ae89de0]
- Updated dependencies [cbb8a8a]
- Updated dependencies [ae89de0]
  - @bombfarm/domain@1.0.0
  - @bombfarm/ui@0.12.0
  - @bombfarm/game-art@0.4.1

## 0.1.1

### Patch Changes

- d155a2f: Move the hero and roster user interface into a package of its own. Nothing a player sees changes:
  the same picker, switcher, sort header, per-hero combat panel and roster wording are drawn by the
  same two apps, from the same numbers.

  What moved is where those views live. They had grown up inside the farm package, which is where the
  farm screen happened to need them first, so the planner and the desktop app both reached through
  the farm screen to render a hero list that has nothing to do with farming. They are now their own
  package, and the farm package depends on it rather than the other way round — a one-way dependency
  a test in the new package enforces, naming the offending file if anything ever imports back.

  The guards that watched these components moved with them: the eight-prop component budget now
  covers the new package too, the desktop rule that only one module may reach the farm screen's
  wording covers both dictionaries, and the two applications' continuous-integration filters now list
  every package they actually compile, so a change to one of them can no longer skip the checks that
  would have caught it.

- Updated dependencies [06c9b42]
- Updated dependencies [a326087]
- Updated dependencies [06c9b42]
- Updated dependencies [06c9b42]
- Updated dependencies [2ab64c9]
- Updated dependencies [06c9b42]
- Updated dependencies [06c9b42]
- Updated dependencies [03c3302]
- Updated dependencies [06c9b42]
- Updated dependencies [06c9b42]
- Updated dependencies [06c9b42]
  - @bombfarm/ui@0.11.0
  - @bombfarm/domain@0.12.0
  - @bombfarm/game-art@0.4.0

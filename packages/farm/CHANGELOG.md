# @bombfarm/farm

## 1.1.0

### Minor Changes

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

- Updated dependencies [306d2d0]
- Updated dependencies [b0f4431]
- Updated dependencies [579684a]
- Updated dependencies [16c218d]
- Updated dependencies [306d2d0]
- Updated dependencies [306d2d0]
- Updated dependencies [306d2d0]
- Updated dependencies [b0f4431]
- Updated dependencies [b0f4431]
- Updated dependencies [306d2d0]
- Updated dependencies [306d2d0]
- Updated dependencies [306d2d0]
- Updated dependencies [047ce89]
- Updated dependencies [306d2d0]
- Updated dependencies [30428ba]
- Updated dependencies [fcc507e]
- Updated dependencies [306d2d0]
- Updated dependencies [61ee478]
- Updated dependencies [6fe7247]
- Updated dependencies [843027d]
- Updated dependencies [5dffa73]
  - @bombfarm/domain@1.1.0
  - @bombfarm/hero@0.2.0
  - @bombfarm/ui@0.12.2
  - @bombfarm/game-art@0.5.0

## 1.0.1

### Patch Changes

- Updated dependencies [f3a35b8]
  - @bombfarm/ui@0.12.1
  - @bombfarm/domain@1.0.1
  - @bombfarm/game-art@0.4.2
  - @bombfarm/hero@0.1.3

## 1.0.0

### Major Changes

- ae89de0: Make the Farm Respec Advisor's Optimize button permanent, and drop the background estimate that
  used to decide whether it appeared at all.

  The board ran a fast estimate on every roster change and showed the control only when that
  estimate cleared 1%. The estimate is a deliberate lower bound, and it under-reports badly: across
  the committed captures it recovered between 33% and 70% of the gain the real search finds, so an
  account with a genuine double-digit respec available could be told nothing and offered no way to
  ask. Raising the bar would have made that worse, not better. The estimate is gone entirely — one
  whole tier of the solver, its memo, its dependency tuple and its toolbar callout — and Optimize is
  now always pressable, on any roster, whatever the board thinks.

  The 5% floor moves onto the number it can actually speak for. Pressing Optimize runs the full
  search as before; if the best build it finds is worth less than 5% more gold per hour, the panel
  says so and names the figure it found, rather than laying out a per-hero respec that costs more
  than it returns. A build that is already optimal and one that is merely close now give the same
  honest answer. Above the floor nothing changes: the gain, the phase, the cost, the payback, the
  per-hero split and the cheaper-respec frontier all render exactly as before.

### Minor Changes

- ae89de0: Let the Team plan search be scored for gold per hour, and make that the default.

  The page has always maximised the roster's duty-weighted sustained damage. That quantity is not
  what a farming account earns, and following the plan could leave a player farming worse than
  before. The search has been able to score for gold for a while; nothing on screen could ask for
  it. There is now a **Score for** control on the search setup panel with two settings, Gold and
  Damage, and it starts on Gold.

  Only the web planner's default changes. The shared search keeps damage as its own default, so
  every other caller is byte-identical.

  Changing the setting drops any plan already on screen rather than flagging it stale, and disowns a
  search still running. A gold plan and a damage plan report different quantities in different
  units, so leaving one under the other's heading would print a wrong number, not merely an old one.

  Every string on the page that named the quantity being reported now exists twice, once per
  setting, and a gold plan reports gold per hour throughout: the total gain reads `gold/h` rather
  than `dps`, the results heading, the field-saturation notes, the temporarily-behind line and the
  skipped-forge note all follow. Both languages. The page reads those strings only through a single
  resolver, and a test fails if any component reaches around it or if a damage word appears in a
  gold-mode string.

  Scoring for gold needs the furthest phase the account has reached, and the search refuses to guess
  it. A save that did not carry one now says so and offers damage instead of failing mid-search.

  Separately, the Farm page's respec advisor now states its own scope: it moves stat points, and
  never gear or forge work. The web planner adds that the Team plan page covers the rest. The
  desktop app has no such page, so the shared panel names no destination there.

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
  - @bombfarm/hero@0.1.2

## 0.2.4

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
- Updated dependencies [d155a2f]
  - @bombfarm/ui@0.11.0
  - @bombfarm/domain@0.12.0
  - @bombfarm/game-art@0.4.0
  - @bombfarm/hero@0.1.1

## 0.2.3

### Patch Changes

- Updated dependencies [006f970]
- Updated dependencies [f534b9e]
- Updated dependencies [37fd673]
- Updated dependencies [a8f352f]
- Updated dependencies [f534b9e]
  - @bombfarm/domain@0.11.0
  - @bombfarm/ui@0.10.0
  - @bombfarm/game-art@0.3.6

## 0.2.2

### Patch Changes

- Updated dependencies [4b6d4ba]
- Updated dependencies [4b6d4ba]
- Updated dependencies [652ab4a]
  - @bombfarm/ui@0.9.1
  - @bombfarm/domain@0.10.2
  - @bombfarm/game-art@0.3.5

## 0.2.1

### Patch Changes

- Updated dependencies [18a722d]
  - @bombfarm/ui@0.9.0
  - @bombfarm/game-art@0.3.4

## 0.2.0

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

- Updated dependencies [4b76ad3]
- Updated dependencies [b02478e]
- Updated dependencies [090f1ce]
- Updated dependencies [972e2d1]
  - @bombfarm/ui@0.8.0
  - @bombfarm/game-art@0.3.3
  - @bombfarm/domain@0.10.1

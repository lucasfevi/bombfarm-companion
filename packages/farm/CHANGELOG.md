# @bombfarm/farm

## 1.2.3

### Patch Changes

- Updated dependencies [fdc8b8e]
  - @bombfarm/domain@1.3.1
  - @bombfarm/game-art@0.6.3
  - @bombfarm/hero@0.3.3

## 1.2.2

### Patch Changes

- c5d3c51: Skill Tree: the selected node opens as a card over the tree, and the gate picker is the Optimizer's phase control.

  Selecting a node — on the tree or in the ranking — opens a closable card over the tree instead of a panel in the side column. The card marks a node the wallet covers with the same green check the ranking uses, prints gold with the coin, keeps every row to one line, explains refunds and the one-level-up figures behind info tips, and shows the node it hangs off as a link: hover for that node's facts, click to jump to it.

  The gate objective's phase picker is the same searchable phase control the Optimizer uses, listing gate phases only, at the height of the objective buttons. The web planner, which has no PVP squad source, offers gold and gate only.

- Updated dependencies [c5d3c51]
- Updated dependencies [c88f96b]
- Updated dependencies [c5d3c51]
- Updated dependencies [c5d3c51]
  - @bombfarm/domain@1.3.0
  - @bombfarm/ui@0.14.1
  - @bombfarm/game-art@0.6.2
  - @bombfarm/hero@0.3.2

## 1.2.1

### Patch Changes

- Updated dependencies [cb9b319]
  - @bombfarm/hero@0.3.1
  - @bombfarm/domain@1.2.1
  - @bombfarm/game-art@0.6.1

## 1.2.0

### Minor Changes

- 9af518a: Price any team aura at its cap on the desktop's Farm board and Optimizer, one chip per aura.

  **Auras 100% uptime** is a new field beside the Return Bonus on the Farm board's control row and in the
  Optimizer's setup bar: the six team auras — War Cry, Deadly Omen, Forced March, Miner's Breath,
  Breach and Baton Pass — drawn as the icon tiles the Heroes screen uses, each a switch. Lit, an
  aura is priced as if it held the whole field at its cap the entire time, whatever the rotation
  would sustain on its own: a standing aura's rotation-weighted total is held at its cap (and a
  held Miner's Breath reaches every carrier's field seconds, so uptimes move with it), and Baton
  Pass's pulse is held at its capped level, priced through every hero's own hits-to-kill step on the
  board and as the capped multiplier on every Optimizer score. Unlit — the default — nothing
  changes: every aura counts for the share of the time its carriers are on the field, exactly as
  before. Hovering a chip names the aura, its effect and its cap.

  Lighting a chip recomputes the board and clears the plan, the same way "Keep every hero geared"
  does, and each screen remembers its own set. The web planner is untouched: it offers no such
  control and prices every aura as the pool sustains it.

### Patch Changes

- dde8fe4: Hovering an item, a hero or an ability opens a card that reads it — the way a gear link does on
  a game database site — everywhere the app draws one as an icon.

  - **An item's card** names the piece with its forge level, says its tier, level and forge
    multiplier, lists every stat it rolls at that level and forge with the inventory card's dotted
    leaders, and ends with what it is worth — the gold the game pays and the Steam market quote
    where the host has one. An inventory row's card prints the rolls the game reported for that
    exact item, the same figures the row itself shows, so the two never disagree after a patch
    moves the catalog.
  - **An ability's card** says the rank and scope (a TEAM aura, or a bonus on the hero's own
    sheet), what one rank does, and what this rank and the cap add up to — "+52% crit damage" at
    rank 13, "+80%" at 20. The roster's ability filters open the same card without a rank.
  - **A hero's card** reads the whole record where one is at hand: rank, name and stars, tier
    and level, power at the head, the geared sheet in two columns, then the abilities and all
    eight gear slots as art, an empty tile standing in for a bare slot. A row that only knows a
    name and a rank gets a card that says that much and no more.

  Two surfaces reshape around the cards. The Combat tab's Abilities & Auras panel stops
  repeating each ability's effect sentence — the card says it — and draws its two groups side by
  side as columns of small cards, each icon opening its card and an own ability's icon carrying
  its rank badge. The desktop Live tab's rows (the mini window's too, and the web download page's
  replica of them) draw the same identity block every roster surface uses, without the rarity
  word, and the avatar opens the hero's card from the account's own record. The forge queue's band
  shows the piece at its head as art that opens the item's card.

  Also fixed on the way: the inventory card capped an item at four stat lines, so a Legendary or
  Mythic piece hid its fifth and sixth rolls — every roll shows now.

  Where it opens: the roster rows and cards, the hero picker, the import dialog, the Home
  overview, the Farm rotation pool and top-9 table, the Optimizer's scope cards, proposed
  items and forge queue, the inventory grid and table (the item, and the hero wearing it), the
  Account tab's hero list, and the desktop Forge queue. An icon that is the subject of its own screen — the selected hero's strip,
  its Gear tab cards, the ability editor — stays bare: the card would only repeat the screen.

  The hovered icon brightens and lifts so a peekable icon looks like one; the trigger stays out of
  the tab order so a row of ten icons keeps its one stop. On the 28px tiles the forge level shrinks
  to an 8px mono glyph in the corner, so it no longer covers a third of the art. Icons drawn inside
  a card open nothing — a card is one level deep.

  The gear and ability strips' older two-line tooltips are gone, replaced by the cards.

- Updated dependencies [9af518a]
- Updated dependencies [8a77e75]
- Updated dependencies [fe508c2]
- Updated dependencies [6e82439]
- Updated dependencies [fe508c2]
- Updated dependencies [de6ad93]
- Updated dependencies [dde8fe4]
  - @bombfarm/domain@1.2.0
  - @bombfarm/hero@0.3.0
  - @bombfarm/ui@0.14.0
  - @bombfarm/game-art@0.6.0

## 1.1.1

### Patch Changes

- Updated dependencies [1ef139c]
  - @bombfarm/ui@0.13.1
  - @bombfarm/domain@1.1.1
  - @bombfarm/game-art@0.5.1
  - @bombfarm/hero@0.2.1

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

- 2b8bc83: The Farm page's Optimize button opens the Optimizer — the Optimizer page on the web planner, the Optimizer tab on the desktop app — instead of expanding a points-only respec panel in place. That panel, its per-hero split, its cheaper-respec frontier and the "show ranking under this build" switch are gone with it: the Optimizer already recommends points, gear moves and forges together for the same roster, and two surfaces answering "what should I change" with different scopes read as two different answers. The Home page's optimizer card keeps its "already close to the best found" verdict for a plan under the worth-making floor.
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

- 882da7f: Rename the Planner page to **Heroes**, and its URL from `/planner` to `/heroes`.

  "Planner" was the name of the whole site before it grew a Farm board, an Optimizer, an Inventory and an Account page; as one tab among six it named nothing in particular. The page is the per-hero workspace — the roster rail, and the Hero, Gear, Points and Combat tabs for the hero you pick — and "Heroes" is what the desktop app has always called the same screen. In Portuguese it is **Heróis**.

  `/planner` keeps working. It is a redirect stub that replaces itself with `/heroes` — the same shape `/phases` and `/team-plan` have used since their renames — so a link shared before today still lands, is not indexed, and does not trap the Back button. The page's share card is re-rendered under its new name.

  The Farm board's empty-roster note no longer sends you "to the Planner": it says to import heroes, and the link beside it names the page — so the shared copy stays true on the desktop app, which reads the account from the game and has nothing to import.

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

- Updated dependencies [a112580]
- Updated dependencies [0d241f6]
- Updated dependencies [5ad5aa2]
- Updated dependencies [306d2d0]
- Updated dependencies [0ba2534]
- Updated dependencies [9df458b]
- Updated dependencies [b0f4431]
- Updated dependencies [579684a]
- Updated dependencies [33ff64b]
- Updated dependencies [374c22d]
- Updated dependencies [16c218d]
- Updated dependencies [5ad5aa2]
- Updated dependencies [c3019aa]
- Updated dependencies [306d2d0]
- Updated dependencies [306d2d0]
- Updated dependencies [306d2d0]
- Updated dependencies [dae7398]
- Updated dependencies [b0f4431]
- Updated dependencies [b0f4431]
- Updated dependencies [c336926]
- Updated dependencies [306d2d0]
- Updated dependencies [306d2d0]
- Updated dependencies [306d2d0]
- Updated dependencies [8afbad5]
- Updated dependencies [047ce89]
- Updated dependencies [306d2d0]
- Updated dependencies [30428ba]
- Updated dependencies [13c01e7]
- Updated dependencies [aa63003]
- Updated dependencies [fcc507e]
- Updated dependencies [306d2d0]
- Updated dependencies [374c22d]
- Updated dependencies [8ca17f2]
- Updated dependencies [c4573ed]
- Updated dependencies [61ee478]
- Updated dependencies [6fe7247]
- Updated dependencies [843027d]
- Updated dependencies [5dffa73]
- Updated dependencies [4329c1a]
  - @bombfarm/hero@0.2.0
  - @bombfarm/domain@1.1.0
  - @bombfarm/game-art@0.5.0
  - @bombfarm/ui@0.13.0

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

# @bombfarm/team-plan

## 0.2.2

### Patch Changes

- Updated dependencies [c5d3c51]
- Updated dependencies [c88f96b]
- Updated dependencies [c5d3c51]
- Updated dependencies [c5d3c51]
- Updated dependencies [c5d3c51]
  - @bombfarm/domain@1.3.0
  - @bombfarm/ui@0.14.1
  - @bombfarm/farm@1.2.2
  - @bombfarm/game-art@0.6.2
  - @bombfarm/hero@0.3.2

## 0.2.1

### Patch Changes

- Updated dependencies [cb9b319]
  - @bombfarm/hero@0.3.1
  - @bombfarm/domain@1.2.1
  - @bombfarm/farm@1.2.1
  - @bombfarm/game-art@0.6.1

## 0.2.0

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
  - @bombfarm/farm@1.2.0
  - @bombfarm/ui@0.14.0
  - @bombfarm/game-art@0.6.0

## 0.1.1

### Patch Changes

- Updated dependencies [1ef139c]
  - @bombfarm/ui@0.13.1
  - @bombfarm/domain@1.1.1
  - @bombfarm/farm@1.1.1
  - @bombfarm/game-art@0.5.1
  - @bombfarm/hero@0.2.1

## 0.1.0

### Minor Changes

- 2b8bc83: The Farm page's Optimize button opens the Optimizer — the Optimizer page on the web planner, the Optimizer tab on the desktop app — instead of expanding a points-only respec panel in place. That panel, its per-hero split, its cheaper-respec frontier and the "show ranking under this build" switch are gone with it: the Optimizer already recommends points, gear moves and forges together for the same roster, and two surfaces answering "what should I change" with different scopes read as two different answers. The Home page's optimizer card keeps its "already close to the best found" verdict for a plan under the worth-making floor.
- 374c22d: The Optimizer no longer shows an "Assumptions & limits" panel under its results, on the web
  planner or the desktop app. What it said was technical — unmodelled abilities, loadout drift
  against the inventory snapshot, excluded-item counts, aura and Planner-divergence notes, forge
  and Luck caveats, restricted-plan notes — and did not change what a player should do with the
  plan above it. The run summary, gain breakdown and per-hero table are unchanged.

  Everything that existed only to feed that panel goes with it: the `disclosures` field on a
  computed team plan, the package component and its copy, and the four host-supplied strings each
  app provided for it.

- 374c22d: A new package holds the optimizer: its screen, the runner and its worker, the input model and
  the rules that decide when a plan is stale and which control changes clear it. The web planner now
  draws `/optimizer` from that package through a connector that maps its own store onto the
  package's flat inputs record, and nothing on the page changes for a player — same layout, same
  strings, same behaviour, proven by the optimizer's browser suite passing without an edit.

  Strings that name a screen only one host has — the empty states and their call to action, the
  remedy shown when gold scoring has no furthest phase, the two disclosures that name the Planner
  and the Account tab, the farm advisor's pointer, and the blocked notice's re-export sentence — are
  a contract type each host satisfies from its own dictionary. A host-neutral test forbids those
  words in the shared dictionary and demonstrates its own red state.

  The scope hero card, the per-hero delta row and the waterfall step cell carry an explicit
  `memo()`: the React Compiler does not run over a package a host transpiles, so a component that
  reaches a host that way keeps only the memoisation its own source spells.

### Patch Changes

- 9df458b: The Effective stats panel on the Combat tab (web planner) and the Combat stage (desktop Heroes
  screen) no longer folds each figure behind an accordion row. Both apps now draw one shared panel
  from the hero package: the combat figures as a pipeline of cards — Sheet (the seven combat sheet
  stats), Factors (Damage multiplier, Mitigation factor, Critical factor, Fuse, Field time, Rest),
  Per hit · cadence (Hit, Critical hit, Average hit, Bombs/s, Uptime) and DPS (Active, Sustained)
  — with curved wires between the cards that feed each other, so every figure is visible without a
  click and Speed's card is seen feeding Bombs/s. Each card carries a short symbolic formula, and at
  its bottom edge the icon of every ability or aura that reaches it — Grito on Attack, Marcha on
  Speed, Presságio on Crit Chance, Brecha on Penetration, Detonação Dupla, Misericórdia, Matilha and
  Passagem de Bastão on Damage multiplier, Fôlego and Bateria Extra on Field time, Explosão Ampla on
  Active DPS, Contra o Relógio on Attack on a gate phase — dimmed while the aura's switch is off;
  hovering an icon names the ability. Hovering or focusing a card opens one popover on both layouts:
  a derived figure shows its substituted formula with every term named, the inputs it reads as
  chips, and a note where the model has one (the fuse at its ceiling, an average hit equal to the
  hit because crit chance is zero, what Field time would read without the team's Fôlego); a sheet
  stat shows its ledger grouped by game line. Hovering a card also lights the wires that feed it.
  The Mitigation factor card carries the penetration reading ("covers the phase" / "12.2% short of
  this phase") that the hero panel used to print; that panel leaves the Combat stage altogether —
  the hero is the one the strip or the roster holds, and the prop table goes with it (the Farm
  page's hero panel keeps both). Under the pipeline, the seven combat sheet stats as a matrix — Hero
  (base, level, stars and points folded to one figure; hover for the four), Gear, Ability, Skill
  tree, Sheet total, Aura ×, Effective — always all seven rows, with "—" for an empty cell and "off"
  where an aura exists but its switch is off; a Rune × column appears only while a rune is on the
  sheet. The panel's own width picks the layout: the pipeline at 820px and up, the same cards
  stacked one per row under the same four labels below that. Average hit joins the derived
  breakdown as its own figure (hit × critical factor), and the Active DPS formula reads it rather
  than a second damage multiplier — no value moves.

  Baton Pass is now the sixth team aura behind a switch in the Abilities & auras section, beside
  the five standing ones: the hero's own rank counts on its own entry pulse and cannot be switched
  off; for a hero without it the switch prices that pulse at the field-wide cap (+80% for the
  window), whoever would carry it, and the row says what flipping it does to sustained DPS like the
  others. It leaves the own-abilities list. The drain-reductions note under the section is gone.

  Both panels on the Combat tab and stage now carry their explanation behind an info glyph beside
  the title, the way the Optimizer's setup bar does, instead of an intro paragraph; the Effective
  stats explanation no longer describes how Baton Pass is counted. The info glyph is a design-system
  primitive now, `InfoTip`, and the Optimizer draws it from there.

  A hero's own Baton Pass pulse now reaches every figure a per-hero screen prints, not only the
  DPS pair: Hit, Critical hit and Average hit carry the pulse's expectation over wall clock, and the
  Damage multiplier card names the pulse as its own factor — so switching Baton Pass on moves Hit
  the way it moves Sustained DPS. Hits-to-kill still reads the unpulsed hit (a threshold is crossed
  at a level the field sits at, never at the average of two), and the Farm board's pricing is
  untouched.

  On a hero's own screen Baton Pass is counted as if its pulse never lapsed — the whole stint at
  its level, +80% at the cap — because the screen answers what the hero is worth with the pulse on;
  the Farm page and the Optimizer keep counting only the 120 s each entry lights. The Damage
  multiplier card's popover says so, the aura row's figure reads "pulse held up", and the section's
  info glyph explains the difference. A line under the Effective stats title says a card's figure
  opens its formula on hover or focus; inside a popover the main figure stays white while every
  term, step and running total is accent or muted, and the popover grows to keep a formula on one
  line. The sheet-stat matrix is striped.

  The penetration reading told the wrong story. Penetration pierces a share of the phase's
  mitigation (`dano = ataque × (1 − mitig × (1 − pen/100))`), not points off it, so 42.6%
  penetration against an 8.36% phase still loses 4.8% of every hit — yet the hero panel called that
  "covering the phase" / "Fully piercing" because 42.6 ≥ 8.36, and the Phases page's mitigation tip
  said "8.4% pen ignores all mitigation". Both now say what the phase still takes off each hit
  ("4.8% of each hit lost — 42.6% of the phase's 8.36% pierced"), "nothing lost" only at 100%, and
  the Mitigation factor card's popover spells the rule out.

- c3019aa: Forge queue: forge the Optimizer's chores in turn, without leaving the tab.

  **Add to queue on every forge chore.** Each entry of an Optimizer hero row's forge queue carries
  an _Add to queue_ button; one press puts the piece and its target on the app's forge queue and the
  button reads _Queued_. One entry per piece — a re-run plan that moves a piece's target moves the
  queued target rather than adding a second entry.

  **A band under the top bar runs it.** While the queue holds anything, a band between the nav and
  the screen shows the queue: `0/3 forged`, the piece rolling and its climb so far
  (`+9 → +12 · 4 rolls · 12.3k gold`), and Start or Cancel. Start asks first — the dialog prints the
  expected gold for everything queued, coin and all — and is
  held back for the same reasons the Forge button is: an account with no server behind it, or the
  forge writes switch off. Pieces are forged in order with no per-piece limits, one run at a time
  through the same path the Forge tab uses, so the Forge tab's rail draws each queued run as it
  rolls. The queue stops on any piece that stops short of its target — out of gold, a server
  cooldown, a refused item — and names the reason in the band; Resume picks up from that piece.
  A piece the bag no longer holds, or one already at its target, leaves the queue on its own.

  **The Forge tab lists it, feeds it and runs it.** A Forge queue panel beside the bag lists every
  queued piece with its climb, lets you take one off, and carries the same Start, Cancel and Clear
  as the band; the plan panel carries _Add to queue_ under its Forge button — the piece in hand, at the
  target the panel shows. The waiting pieces survive a restart — restored paused, never started on
  their own.

  `@bombfarm/team-plan`: `TeamPlanScreenSlots.forgeQueueAction` — a host-supplied control drawn at
  the end of each forge-queue entry. The web supplies none and renders exactly as before.

  `@bombfarm/ui`: `AppShell` gains a `banner` slot between the top bar and `<main>` (absent renders
  nothing), and `ConfirmDialog`'s close sits in the popup's own corner rather than inside the
  padding.

- 374c22d: The note over the Optimizer's per-hero table no longer says the figures ignore the game's crit and cooldown caps. They never did — every DPS the search scores runs through those caps; only the Stats panel's raw sheet totals can read past them, and that panel marks a capped line itself.
- 374c22d: The Optimizer's per-hero rows label their three figures "DPS before", "DPS after" and "Δ DPS", so the number is named where it is read rather than two paragraphs above.
- 13c01e7: The Optimizer keeps its place while you look at another screen.

  Leaving the Optimizer for the Forge tab and coming back used to reopen the first hero's row and
  put the page back at the top, on every trip. Now the rows you had open stay open and the page
  returns to where you left it, on every desktop tab; on the web planner, the open rows survive a
  move to another page as well. A new plan still opens its first hero by default.

  The per-hero result rows now also keep naming the heroes the plan was solved from, so a hero
  that a later account read could not model no longer loses its avatar and details in the list.

- 374c22d: Fixed the optimizer screen dropping a finished plan when its search fell back to the main
  thread — the run's start was never reported to the host that started it, on either host, so the
  finished plan (or the labelled error) never reached the screen.
- 374c22d: The Optimizer's search-setup fields now wrap onto a second row in a narrow window instead of
  squeezing their text illegible, and a hero card's level and id line ends in an ellipsis instead of
  spilling past the card's edge.
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
- Updated dependencies [2b8bc83]
- Updated dependencies [c3019aa]
- Updated dependencies [306d2d0]
- Updated dependencies [306d2d0]
- Updated dependencies [306d2d0]
- Updated dependencies [dae7398]
- Updated dependencies [b0f4431]
- Updated dependencies [b0f4431]
- Updated dependencies [c336926]
- Updated dependencies [306d2d0]
- Updated dependencies [882da7f]
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
  - @bombfarm/farm@1.1.0

# @bombfarm/account

## 0.3.23

### Patch Changes

- Updated dependencies [8e9c020]
- Updated dependencies [4219c4e]
- Updated dependencies [8247b1e]
- Updated dependencies [f97ab4a]
  - @bombfarm/domain@1.15.3
  - @bombfarm/ui@0.20.2
  - @bombfarm/game-art@0.8.12

## 0.3.22

### Patch Changes

- Updated dependencies [7ea9736]
- Updated dependencies [a15897a]
- Updated dependencies [ddcd119]
- Updated dependencies [96cc454]
  - @bombfarm/domain@1.15.2
  - @bombfarm/ui@0.20.1
  - @bombfarm/game-art@0.8.11

## 0.3.21

### Patch Changes

- Updated dependencies [b3125b4]
  - @bombfarm/domain@1.15.1
  - @bombfarm/game-art@0.8.10

## 0.3.20

### Patch Changes

- Updated dependencies [6ae432b]
- Updated dependencies [36a0a4a]
- Updated dependencies [54e4d0b]
- Updated dependencies [266f0f2]
- Updated dependencies [e644ef6]
- Updated dependencies [2809005]
- Updated dependencies [adebf65]
- Updated dependencies [d28b388]
- Updated dependencies [bbcd719]
- Updated dependencies [8f0c47a]
- Updated dependencies [1a902f5]
  - @bombfarm/domain@1.15.0
  - @bombfarm/ui@0.20.0
  - @bombfarm/game-art@0.8.9

## 0.3.19

### Patch Changes

- Updated dependencies [d9b6421]
  - @bombfarm/domain@1.14.1
  - @bombfarm/game-art@0.8.8

## 0.3.18

### Patch Changes

- Updated dependencies [72fd307]
- Updated dependencies [fb25bb8]
  - @bombfarm/domain@1.14.0
  - @bombfarm/game-art@0.8.7

## 0.3.17

### Patch Changes

- Updated dependencies [f950911]
- Updated dependencies [7c92147]
  - @bombfarm/domain@1.13.0
  - @bombfarm/ui@0.19.1
  - @bombfarm/game-art@0.8.6

## 0.3.16

### Patch Changes

- Updated dependencies [5fe7253]
- Updated dependencies [6cdbae8]
  - @bombfarm/domain@1.12.0
  - @bombfarm/game-art@0.8.5

## 0.3.15

### Patch Changes

- 202804c: The Live screen's XP figures are now exact. XP per hour, the session XP total and a new measured XP per prop are read from the XP the game reports for every prop your heroes destroy, with every bonus included — the Pass, the Return Bonus, a Boost and hero runes — instead of being estimated from the props and reading up to half low. The measured XP per prop sits beside gold per prop and says how far it runs from the map's estimate. The map's estimated XP per prop now counts a running Boost and the XP runes of the heroes on the field (weighted equally across them), and its gold figures count a gold Boost, so the two no longer drift apart under a Boost; when the account read carries no usable XP multiplier the estimate shows "—" instead of a guess. The compact Live window shows the measured XP per prop too, beside the session prop count: the gold balance heads its figures and the rest sit in pairs, gold beside XP and rate beside total. The download page's drawings of both windows show the new figure.

  The Farm board's XP per hour is now right. It never applied your account's XP multiplier, so it read low by that whole factor (more than half low on a strong account); it now does, and when an imported save carries a missing or zero XP multiplier the column shows "—" instead of a guess. With no save imported, the web planner still prices XP, without your account's XP bonuses, and an ⓘ beside the board's title says so. A hero's XP rune now counts too: it multiplies the XP of the props that hero destroys. The Phases panel's XP per prop now includes the Return Bonus, the Pass and your squad's XP runes (each hero's weighted by its share of the kills), so it agrees exactly with the Farm board's row for the same phase. The web planner's Farm board has a new Boost control beside Return Bonus and Pass — one switch each for gold, XP and drop — and a running Boost adds its +100% to the same sum as the Return Bonus and the Pass, on the Farm board, the Phases panel and the Optimizer alike. The desktop app reads the running Boosts from the game instead: its Farm board shows which axes are boosted and prices them, as does its Optimizer, and a Boost starting or ending marks both as out of date so a refresh picks it up. The Optimizer now prices gold with the Farm board's Return Bonus switch too, so its gold per hour matches the board's with the switch on, and its list of what changed since the plan names the switch, and each Boost axis, when it moves.

  The Apprentice ability is now priced. Measured from live traffic, a rank-20 Apprentice on the field multiplies the XP of every prop the field destroys — not just its own — by exactly ×1.15, on top of your XP multiplier, the Return Bonus, the Pass, a Boost and XP runes. The Farm board's XP per hour, the Phases panel's XP per prop, the Optimizer and the Live map's XP estimate all count it: +0.75% per rank, never more than one carrier's +15% however many are on the field, and on the Farm board and the Optimizer weighted by how much of the rotation each carrier spends on the field. The ability's description no longer says it is not modelled, and the hero's ability panel no longer calls Apprentice, Veia de Ouro or Fortuna "not modelled" either: all three are priced by the Farm board, and their next rank now reads as worth something damage does not measure. Only a single rank-20 carrier was measured; lower ranks follow the wiki's per-rank figure, and two carriers together are read as the wiki states them.

  Fortuna's gold aura is now weighted like every other team aura: each carrier counts for the share of the rotation it spends on the field, and two carriers that are each on the field part of the time are no longer read as one that is always there. It used to follow which heroes the House was assumed to refill first, which is how an automated player fills the House rather than a rule of the game. On rosters with one Fortuna carrier the Farm board's gold per hour is unchanged; with two carriers it reads up to about half a percent lower.

- Updated dependencies [3d16ffe]
- Updated dependencies [202804c]
  - @bombfarm/ui@0.19.0
  - @bombfarm/domain@1.11.0
  - @bombfarm/game-art@0.8.4

## 0.3.14

### Patch Changes

- Updated dependencies [e84d206]
- Updated dependencies [0a911da]
  - @bombfarm/domain@1.10.2
  - @bombfarm/game-art@0.8.3

## 0.3.13

### Patch Changes

- Updated dependencies [88d87e6]
- Updated dependencies [045c4d2]
- Updated dependencies [ddffe28]
- Updated dependencies [ddffe28]
- Updated dependencies [7eaa54b]
  - @bombfarm/domain@1.10.1
  - @bombfarm/game-art@0.8.2
  - @bombfarm/ui@0.18.1

## 0.3.12

### Patch Changes

- Updated dependencies [8951cb5]
- Updated dependencies [0925ddb]
- Updated dependencies [bc5f232]
  - @bombfarm/domain@1.10.0
  - @bombfarm/game-art@0.8.1

## 0.3.11

### Patch Changes

- Updated dependencies [7ab7d0e]
- Updated dependencies [7ab7d0e]
- Updated dependencies [5de6480]
- Updated dependencies [5de6480]
- Updated dependencies [7ab7d0e]
- Updated dependencies [7ab7d0e]
  - @bombfarm/domain@1.9.0
  - @bombfarm/ui@0.18.0
  - @bombfarm/game-art@0.8.0

## 0.3.10

### Patch Changes

- Updated dependencies [b7e061c]
- Updated dependencies [c13d140]
- Updated dependencies [c13d140]
- Updated dependencies [c13d140]
- Updated dependencies [b7e061c]
  - @bombfarm/domain@1.8.1
  - @bombfarm/game-art@0.7.7

## 0.3.9

### Patch Changes

- Updated dependencies [b0719ac]
- Updated dependencies [d05770f]
- Updated dependencies [804572b]
- Updated dependencies [41c8786]
- Updated dependencies [034b719]
  - @bombfarm/domain@1.8.0
  - @bombfarm/game-art@0.7.6

## 0.3.8

### Patch Changes

- Updated dependencies [c99325d]
- Updated dependencies [2c54735]
- Updated dependencies [47d106f]
- Updated dependencies [47d106f]
  - @bombfarm/ui@0.17.0
  - @bombfarm/domain@1.7.1
  - @bombfarm/game-art@0.7.5

## 0.3.7

### Patch Changes

- Updated dependencies [3b64976]
- Updated dependencies [3b64976]
  - @bombfarm/ui@0.16.2
  - @bombfarm/game-art@0.7.4

## 0.3.6

### Patch Changes

- Updated dependencies [1a11f0b]
- Updated dependencies [2318b9d]
  - @bombfarm/domain@1.7.0
  - @bombfarm/ui@0.16.1
  - @bombfarm/game-art@0.7.3

## 0.3.5

### Patch Changes

- Updated dependencies [35108e3]
- Updated dependencies [6d34bfe]
- Updated dependencies [9f09846]
- Updated dependencies [35108e3]
- Updated dependencies [64e7fe3]
- Updated dependencies [6d34bfe]
- Updated dependencies [35108e3]
- Updated dependencies [6d34bfe]
- Updated dependencies [6d34bfe]
- Updated dependencies [02dc923]
- Updated dependencies [35108e3]
- Updated dependencies [35108e3]
- Updated dependencies [5b64748]
  - @bombfarm/domain@1.6.0
  - @bombfarm/game-art@0.7.2
  - @bombfarm/ui@0.16.0

## 0.3.4

### Patch Changes

- Updated dependencies [6fe8d07]
- Updated dependencies [aa322d8]
  - @bombfarm/domain@1.5.0
  - @bombfarm/game-art@0.7.1

## 0.3.3

### Patch Changes

- Updated dependencies [4f052fe]
- Updated dependencies [56d8a93]
- Updated dependencies [82d59a2]
- Updated dependencies [4f052fe]
- Updated dependencies [0558cca]
- Updated dependencies [46f4693]
  - @bombfarm/domain@1.4.1
  - @bombfarm/ui@0.15.0
  - @bombfarm/game-art@0.7.0

## 0.3.2

### Patch Changes

- Updated dependencies [87ff56b]
  - @bombfarm/domain@1.4.0
  - @bombfarm/game-art@0.6.4

## 0.3.1

### Patch Changes

- Updated dependencies [fdc8b8e]
  - @bombfarm/domain@1.3.1
  - @bombfarm/game-art@0.6.3

## 0.3.0

### Minor Changes

- c5d3c51: Skill Tree tab: your tree as the game draws it, and what each node is worth to your farm.

  **A new tab, between PVP and Account.** The nav now reads Live · Farm · Heroes · Inventory · Forge ·
  Optimizer · PVP · Skill Tree · Account · Settings. The tab draws every node of your skill tree in
  the game's own layout with its medallion, its owned level and its state — lit, buyable, out of
  gold, waiting on a prerequisite or behind a phase gate. Pick a node to see what each level does,
  what the next one costs, what maxing it costs and what undoing it would return. The tree's totals
  sit beside it, as the game's own summary prints them.

  **Next to buy.** Every node you could buy now is ranked by what one more level adds per million
  gold, either to gold per hour or to team DPS — your choice, remembered between visits. Both are
  priced against the Farm tab's own roster, pool and settings, on the phase the Farm tab is set to —
  or, with none picked there, the phase the account is farming now — so the figures agree with the
  board. A node that pays in drops, XP or bag space is listed with its
  cost and says so; the app does not invent a gold value for it. When the roster cannot be priced
  the tree still draws, without figures.

  **Nothing is bought here.** The tab is a drawing and a ranking; buying stays in the game.

  A tenth tab moves the three widths the top bar degrades at, and a joined-nodes glyph stands in for
  the word at the narrowest widths.

- 34f3afd: Skill Tree: a colour per path, and a progress card for each above the tree.

  Every arm of the tree now draws its rings, edges, glow and progress arcs in its own colour —
  red for Damage, pink for Crit, cyan for Speed, green for Drop/Luck, blue for Energy, violet for
  Geometric, silver for Neutral Axis — and Gold keeps the wallet's gold, as does the hub. Ring
  colour is the path; ring weight and glow are the state, as before; a node the wallet cannot cover
  stays red on every path. The legend says so under its swatches.

  Above the tree, one card per path prints its levels bought over the path's total with a bar, its
  nodes maxed, and the gold sunk into it over what the whole path costs, each with its share. Press
  a card to light that path alone — the rest of the tree fades back — and press it again to release.

### Patch Changes

- c5d3c51: Skill Tree ranking can target a timed gate clear or a 60s PVP window instead of infinite-horizon team DPS.
- c5d3c51: Skill Tree next-to-buy ranking: cost and mean gain under the name, per-million as the large figure.

  The ranking no longer shows the at-roster gold figure or an "affordable now" sentence. A node you can buy gets a green edge and the coin with a check beside its name, one the wallet cannot cover the coin with a cross; selecting a row opens the node's card over the tree, so the list itself never grows or shifts.

- c5d3c51: Skill Tree: the selected node opens as a card over the tree, and the gate picker is the Optimizer's phase control.

  Selecting a node — on the tree or in the ranking — opens a closable card over the tree instead of a panel in the side column. The card marks a node the wallet covers with the same green check the ranking uses, prints gold with the coin, keeps every row to one line, explains refunds and the one-level-up figures behind info tips, and shows the node it hangs off as a link: hover for that node's facts, click to jump to it.

  The gate objective's phase picker is the same searchable phase control the Optimizer uses, listing gate phases only, at the height of the objective buttons. The web planner, which has no PVP squad source, offers gold and gate only.

- c5d3c51: Skill Tree on the web planner, both gold-per-hour figures, and rates to three significant digits.

  The imported save's owned nodes now persist with the account, so the planner grows a Skill Tree
  tab between Inventory and Account — the same drawing and ranking the desktop tab already shows.
  Gold per hour prints the spread mean and the figure at this roster, side by side, and rates keep
  three significant digits so `4.30m/h → 4.34m/h` stays readable.

- Updated dependencies [c5d3c51]
- Updated dependencies [c88f96b]
- Updated dependencies [c5d3c51]
- Updated dependencies [c5d3c51]
  - @bombfarm/domain@1.3.0
  - @bombfarm/ui@0.14.1
  - @bombfarm/game-art@0.6.2

## 0.2.7

### Patch Changes

- Updated dependencies [cb9b319]
  - @bombfarm/domain@1.2.1

## 0.2.6

### Patch Changes

- Updated dependencies [9af518a]
- Updated dependencies [8a77e75]
- Updated dependencies [fe508c2]
- Updated dependencies [6e82439]
- Updated dependencies [fe508c2]
- Updated dependencies [de6ad93]
- Updated dependencies [dde8fe4]
  - @bombfarm/domain@1.2.0
  - @bombfarm/ui@0.14.0

## 0.2.5

### Patch Changes

- Updated dependencies [1ef139c]
  - @bombfarm/ui@0.13.1
  - @bombfarm/domain@1.1.1

## 0.2.4

### Patch Changes

- Updated dependencies [a112580]
- Updated dependencies [0d241f6]
- Updated dependencies [306d2d0]
- Updated dependencies [9df458b]
- Updated dependencies [579684a]
- Updated dependencies [33ff64b]
- Updated dependencies [374c22d]
- Updated dependencies [16c218d]
- Updated dependencies [5ad5aa2]
- Updated dependencies [c3019aa]
- Updated dependencies [dae7398]
- Updated dependencies [b0f4431]
- Updated dependencies [c336926]
- Updated dependencies [306d2d0]
- Updated dependencies [306d2d0]
- Updated dependencies [8afbad5]
- Updated dependencies [047ce89]
- Updated dependencies [30428ba]
- Updated dependencies [13c01e7]
- Updated dependencies [aa63003]
- Updated dependencies [fcc507e]
- Updated dependencies [306d2d0]
- Updated dependencies [374c22d]
- Updated dependencies [8ca17f2]
- Updated dependencies [c4573ed]
- Updated dependencies [6fe7247]
- Updated dependencies [5dffa73]
- Updated dependencies [4329c1a]
  - @bombfarm/domain@1.1.0
  - @bombfarm/ui@0.13.0

## 0.2.3

### Patch Changes

- Updated dependencies [f3a35b8]
  - @bombfarm/ui@0.12.1
  - @bombfarm/domain@1.0.1

## 0.2.2

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

## 0.2.1

### Patch Changes

- Updated dependencies [06c9b42]
- Updated dependencies [a326087]
- Updated dependencies [06c9b42]
- Updated dependencies [2ab64c9]
- Updated dependencies [06c9b42]
- Updated dependencies [03c3302]
- Updated dependencies [06c9b42]
  - @bombfarm/ui@0.11.0
  - @bombfarm/domain@0.12.0

## 0.2.0

### Minor Changes

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

### Patch Changes

- Updated dependencies [006f970]
- Updated dependencies [37fd673]
- Updated dependencies [a8f352f]
- Updated dependencies [f534b9e]
  - @bombfarm/domain@0.11.0
  - @bombfarm/ui@0.10.0

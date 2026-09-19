# @bombfarm/account

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

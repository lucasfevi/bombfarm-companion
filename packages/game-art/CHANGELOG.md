# @bombfarm/game-art

## 0.4.2

### Patch Changes

- Updated dependencies [f3a35b8]
  - @bombfarm/ui@0.12.1
  - @bombfarm/domain@1.0.1

## 0.4.1

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

## 0.4.0

### Minor Changes

- 06c9b42: A forge run holds the next roll's place on the chart, the bag's columns stop moving as you scroll,
  and gold figures carry the game's coin.

  **The chart says a roll is in flight, so nothing says `pausing…` any more.** A run leaves a gap
  between one roll and the next, and the header used to fill that gap with a word. The word was
  effectively always on: the gaps are drawn from 700ms to 2,500ms, so about two in five cleared the
  threshold meant to catch only the long ones, and the word blinked every few rolls. There is no
  threshold now. Where the next mark will land, the chart draws a hollow accent circle with a short
  dashed stub back to the last real one, at the level the piece stands on — because where it lands
  is exactly what nobody knows yet. Both breathe together over 1.4s, or hold still at a middling
  opacity for anyone who has asked for less motion. When the roll settles, the real mark appears at
  that same x and the ghost is gone, which reads as a shape filling in rather than a blink. The mark
  covers the first roll of a run too, not just the gaps between rolls, so there is always either a
  ghost or a fresh mark and never a moment of nothing.

  **The bag's columns held still while it scrolled.** The gear table only keeps the rows you can see
  in the document, so the browser was re-measuring the column widths from whichever slice happened
  to be mounted, and the columns visibly jumped as you scrolled. Measured on a 137-row bag, the
  Forge column went 119px at the top to 144px deep in it — a fifth wider — while Item, Slot and
  Equipped by all shifted to pay for it. The table now sizes its columns once, from the column set
  itself, and gives the item name whatever width is left. The same table draws the web planner's
  inventory list, so its columns hold still now too.

  **Every gold figure on the Forge screen carries the coin.** The plan's expected, bad-run and
  wallet figures, the run's spend and its by-rung gold, the result block's three figures, and the
  ledger's gold column, totals and header — one coin, sized to the text it stands beside, and never
  on a figure that is not gold. The ledger's two summary lines print their gold as its own clause
  for that reason: a coin in front of `2 runs · 13 rolls · 2 fails` would have marked three counts
  that are not money.

  **The result block says how far the run ran from its plan.** Beside the spend, as a signed whole
  percent against the expected figure — `−20%` in the up colour under the plan, `+87%` in the warn
  colour over it but inside the bad run, `+282%` in the down colour past the bad run.

  **The Forge toolbar is three rows, and one dropdown fewer.** The search field takes the first row
  to itself, full width; the hero, slot and forge-level dropdowns share the second with the result
  count and Clear; the rarity chips have the third. Who wears a piece is a chip there now — the same
  `Equipped` chip the Inventory toolbar has — instead of a three-state dropdown, and it appears only
  when the bag actually holds a piece somebody is wearing. Asking for "nobody wearing it" while a
  hero was chosen could only ever show an empty table; with one chip that cannot be asked at all,
  and with a hero chosen the chip goes away entirely, because every row is already one they wear.

- 06c9b42: A finished forge run leads with its verdict, and the bag drops the column that repeated half of
  every name.

  **Against the plan answers the question first.** The block used to run three gold figures and a
  percentage together as one line of prose, wrap, and then draw a bar with two tick marks nothing
  explained. The percentage is now the headline — large, in the mono face, signed and rounded to a
  whole percent — with a phrase beside it saying what it means: _under what the plan expected_ in
  the up colour, _over what the plan expected_ in the warn colour, _worse than a bad run_ in the
  down colour. The bar keeps its place underneath, and the three figures follow it as one quiet
  line — spent, expected, a bad run, each with the game's coin.

  A run that landed on the expected figure is neither under nor over, so it says _exactly what the
  plan expected_ in the muted colour and prints no percentage at all, rather than a signed zero
  picking a side of an inequality. A run cut short after one cheap roll still reads as an outcome:
  `−100% under what the plan expected` is what actually happened.

  **The Forge bag has no Slot column.** A piece's name already reads `Set · Slot`, so the column
  printed half of every name a second time beside it — and the width it took was what squeezed the
  name column at the app's minimum width until the identity block broke apart. Removing it gives
  the name 180px at a 960-wide window instead of 52px, and the bag is now Item, Forge and Equipped
  by. Ordering by slot goes with the column, which the bag's headers were the only route to.

  Nothing else drew that column, so the shared table no longer knows how: the column, its label and
  the inventory model's `slot` sort key are all gone rather than left as a column nothing hosts. The
  web planner's inventory list, which draws through the same table, never asked for it.

- 06c9b42: Gold figures sit on the line of the sentence they are in, and a run that spent what the plan said
  can say so.

  **A gold figure inside a sentence floated above the words beside it.** The coin and its number are
  laid out as a centred flex box, and a flex box whose items are all centred has no baseline of its
  own — the browser synthesises one from the bottom edge, so the whole chunk rides high. Measured in
  the running app: on the Forge run band's header the spend sat 2.89px above `0 rolls` and
  `wallet 16,218,906` on the same line, and on the result block's figures line each of the three
  figures sat 2.56px above the separators between them. Both now read 0.00px. The figure is asked
  for this explicitly, because the synthesised baseline also props a table row open by 3px: the
  farm board's right-aligned gold cells keep the alignment they were built with, unchanged to the
  pixel — same coin, same number, same right edge, same row height.

  **A run could never be told it had spent what the plan said.** The result block has a fourth
  verdict for a spend that matched the plan — no percentage, a muted phrase, neither under nor over
  — and it was reached only when the spend and the expected figure were identical numbers. They
  never are: the expected figure is a value iteration's float (486,379.99999993795 on a measured
  piece) and the server charges whole gold. So every run within a rounding error of its plan printed
  `+0%` or `−0%` beside a phrase that had picked a side. The verdict now follows the figure that is
  actually printed — inside half a percent of expected, the run reads as matching the plan and prints
  no percentage, whichever side of it the spend fell.

- 06c9b42: The inventory list says an item once, and the Forge bag is that same list.

  **Rarity and level leave the columns.** The name cell already prints both — an Épico on one line
  and `Nv 30` under it — so the two columns beside it were the same two facts a second time, and the
  row had grown to 46px to hold the repetition. Both columns are gone. Nothing else about the row
  changed. Ordering by rarity or by level did not go with them: the list layout now offers the same
  sort picker the cards do, so either order is a pick away, and the columns that are left still sort
  from their own headers.

  **The Forge bag reads like the Inventory one.** The Forge screen had grown a table of its own for
  the sake of one column the shared table would not take. It now uses the shared table with a set of
  columns it asks for by name — the piece, its slot, its forge level and the hero wearing it, drawn
  with the same face-and-name block the inventory list uses instead of a bare hero name. A row still
  picks a piece to plan, and the picked row is still marked. A filter that leaves nothing now says
  so once: the word "Clear" was printed both as the explanation and on the button under it.

  **Long bags only render what is on screen.** A mature account carries a few hundred pieces of gear,
  and both screens bound their list, so the rows below the fold are no longer in the page at all —
  two spacers hold their height open, and the scrollbar still measures the whole bag. The column
  headings stay put while the rows move under them. The Forge bag's old 400-row cap, and the
  "refine the filter" line that came with it, are gone: there is nothing left for a cap to protect.

- 06c9b42: An item now reads the same way everywhere it is named.

  **One shape, four surfaces.** The inventory cards, the inventory list, the Forge screen's item
  panel and the Forge screen's list each drew a piece their own way: the card put the forge level on
  the second line beside the tier, the list put it beside the name, the Forge screen ran the tier,
  the slot, the level and the forge together into one grey line. All four now draw the same block —
  the item's art, its name and its forge level on the first line, its tier and its level on the
  second — so a piece you recognise on one screen is the same piece on the next.

  **The level is written one way.** It was three: `Level 60` on the desktop inventory, `Nível 60` in
  Portuguese, and a run-together `nv60` on the Forge screen. It is `Lv 60` everywhere now, and
  `Nv 60` in Portuguese — the same abbreviation the app already uses for a hero's level.

  **Names keep their tier colour where the tier has nowhere else to go.** A key, a house part or a
  skill stone is named by its tier, so the name itself carries the colour; everything else carries
  it on the tier word under the name. The forge level keeps the accent it had in the list, and an
  unforged piece still prints nothing rather than a `+0`.

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

## 0.3.6

### Patch Changes

- f534b9e: Refresh the five house-part rarity icons to the 256×256 art the wiki now serves. They were bundled
  at 128×128 and rendered visibly soft on high-DPI displays.
- Updated dependencies [006f970]
- Updated dependencies [37fd673]
- Updated dependencies [a8f352f]
- Updated dependencies [f534b9e]
  - @bombfarm/domain@0.11.0
  - @bombfarm/ui@0.10.0

## 0.3.5

### Patch Changes

- 4b6d4ba: Hero level chips now read **Nv 61** under a Portuguese UI instead of **Lv 61**. The prefix was
  written into the shared hero identity block in English, so every Portuguese surface that showed a
  hero level printed the English abbreviation. A level that has not been read yet now shows a dash
  rather than claiming level 0.
- Updated dependencies [4b6d4ba]
- Updated dependencies [4b6d4ba]
- Updated dependencies [652ab4a]
  - @bombfarm/ui@0.9.1
  - @bombfarm/domain@0.10.2

## 0.3.4

### Patch Changes

- Updated dependencies [18a722d]
  - @bombfarm/ui@0.9.0

## 0.3.3

### Patch Changes

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
- Updated dependencies [b02478e]
- Updated dependencies [090f1ce]
- Updated dependencies [972e2d1]
  - @bombfarm/ui@0.8.0
  - @bombfarm/domain@0.10.1

## 0.3.2

### Patch Changes

- Updated dependencies [af7bd8c]
  - @bombfarm/domain@0.10.0
  - @bombfarm/ui@0.7.1

## 0.3.1

### Patch Changes

- Updated dependencies [3eb7026]
  - @bombfarm/ui@0.7.0
  - @bombfarm/domain@0.9.1

## 0.3.0

### Minor Changes

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

- b7d837a: Add `SpriteLoop`, a shared preloading, reduced-motion-aware pixel-art frame loop, generalised out
  of the web team-plan optimizing modal's hero6 bomb-activation animation so both apps can reuse the
  same implementation. `SpriteLoop` now also takes an `animate` prop to hold the loop on its first
  frame on demand, independent of reduced-motion. The web modal's own animation is unchanged.

  The desktop Live tab's "waiting for the first account read" screen now shows Hero 6's pixel-art
  idle animation while the app is reading the account or retrying a connection gap on its own, so a
  long wait reads as working rather than stalled. The sprite holds still on its first frame while
  consent is missing, since nothing is actually in progress in that state, and it honours
  reduced-motion settings.

### Patch Changes

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
- Updated dependencies [48ae346]
- Updated dependencies [b7d837a]
- Updated dependencies [8ba7408]
- Updated dependencies [19197cc]
- Updated dependencies [48ae346]
- Updated dependencies [48ae346]
  - @bombfarm/ui@0.6.0
  - @bombfarm/domain@0.9.0

## 0.2.1

### Patch Changes

- Updated dependencies [74e3119]
  - @bombfarm/domain@0.8.1

## 0.2.0

### Minor Changes

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

- dec4425: Desktop Planning now shows the same hero art as the web planner: a rarity-tinted avatar in the
  roster list and on the selected hero's detail card, plus the rarity label coloured to match. The
  hero-avatar/rank/rarity/gear/ability icon components moved out of the web app into a new shared
  `@bombfarm/game-art` package so both apps render identical chrome; the web planner's own call
  sites are unchanged.

### Patch Changes

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
- Updated dependencies [5a4620b]
- Updated dependencies [dec4425]
- Updated dependencies [1d9d79f]
- Updated dependencies [82f93dd]
- Updated dependencies [550b376]
- Updated dependencies [1d9d79f]
- Updated dependencies [dec4425]
- Updated dependencies [d5a412c]
  - @bombfarm/ui@0.5.0
  - @bombfarm/domain@0.8.0

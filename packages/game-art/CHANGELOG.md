# @bombfarm/game-art

## 0.3.7

### Patch Changes

- Updated dependencies [a326087]
- Updated dependencies [2ab64c9]
  - @bombfarm/domain@0.12.0
  - @bombfarm/ui@0.10.1

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

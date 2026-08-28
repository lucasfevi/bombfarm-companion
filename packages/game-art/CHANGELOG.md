# @bombfarm/game-art

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

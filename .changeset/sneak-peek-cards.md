---
"@bombfarm/game-art": minor
"@bombfarm/domain": minor
"@bombfarm/hero": patch
"@bombfarm/farm": patch
"@bombfarm/team-plan": patch
"@bombfarm/web": minor
"@bombfarm/desktop": minor
---

Hovering an item, a hero or an ability opens a card that reads it — the way a gear link does on
a game database site — everywhere the app draws one as an icon.

- **An item's card** names the piece in its tier colour with its forge level, says its tier and
  level, lists every stat it rolls at that level and forge, and says which slot and set it is.
  An inventory row's card prints the rolls the game reported for that exact item, the same
  figures the row itself shows, so the two never disagree after a patch moves the catalog.
- **An ability's card** says the rank, what one rank does, and what this rank and the cap add
  up to — "+52% crit damage" at rank 13, "+80%" at 20 — and tags a team aura as one.
- **A hero's card** reads the whole record where one is at hand: rank, name and stars, tier
  and level, the geared sheet in two columns, then the abilities and the gear as art. A row
  that only knows a name and a rank gets a card that says that much and no more.

Where it opens: the roster rows and cards, the hero picker, the import dialog, the Home
overview, the Farm rotation pool and top-9 table, the Optimizer's scope cards, proposed
items and forge queue, the inventory grid and table (the item, and the hero wearing it), and the
desktop Forge queue. An icon that is the subject of its own screen — the selected hero's strip,
its Gear tab cards, the ability editor — stays bare: the card would only repeat the screen.

The hovered icon brightens and lifts so a peekable icon looks like one; the trigger stays out of
the tab order so a row of ten icons keeps its one stop. On the 28px tiles the forge level shrinks
to an 8px mono glyph in the corner, so it no longer covers a third of the art. Icons drawn inside
a card open nothing — a card is one level deep.

The gear and ability strips' older two-line tooltips are gone, replaced by the cards.

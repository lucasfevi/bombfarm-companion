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

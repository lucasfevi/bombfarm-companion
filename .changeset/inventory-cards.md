---
"@bombfarm/domain": minor
"@bombfarm/game-art": minor
"@bombfarm/web": minor
"@bombfarm/desktop": minor
---

Inventory cards that show the whole item, and a way to find one

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

Above the grid there is now a search box and filters — by kind, by rarity, and equipped-only — so
finding one item among several hundred does not mean scrolling. Search matches the item's name in
your own language as well as the game's internal id.

The English planner also stops showing Portuguese item names. Gear was being named by
title-casing the game's own slot token, so an English player saw "Gold · Elmo" where they should
have seen "Gold · Helm".

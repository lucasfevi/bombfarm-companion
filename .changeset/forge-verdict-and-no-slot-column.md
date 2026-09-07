---
"@bombfarm/domain": minor
"@bombfarm/game-art": minor
"@bombfarm/desktop": minor
"@bombfarm/web": patch
---

A finished forge run leads with its verdict, and the bag drops the column that repeated half of
every name.

**Against the plan answers the question first.** The block used to run three gold figures and a
percentage together as one line of prose, wrap, and then draw a bar with two tick marks nothing
explained. The percentage is now the headline — large, in the mono face, signed and rounded to a
whole percent — with a phrase beside it saying what it means: *under what the plan expected* in
the up colour, *over what the plan expected* in the warn colour, *worse than a bad run* in the
down colour. The bar keeps its place underneath, and the three figures follow it as one quiet
line — spent, expected, a bad run, each with the game's coin.

A run that landed on the expected figure is neither under nor over, so it says *exactly what the
plan expected* in the muted colour and prints no percentage at all, rather than a signed zero
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

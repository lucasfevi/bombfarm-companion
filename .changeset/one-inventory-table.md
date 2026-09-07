---
"@bombfarm/game-art": minor
"@bombfarm/desktop": patch
"@bombfarm/web": patch
---

The inventory list says an item once, and the Forge bag is that same list.

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

---
"@bombfarm/team-plan": minor
"@bombfarm/desktop": minor
"@bombfarm/web": minor
---

The Optimizer says what changed since the plan — and stops calling a plan stale when nothing it depends on moved.

**Why the notice kept appearing.** The plan was keyed to a hash of each hero record, and that
record carries the game's field flag, its battle permission, a derived power figure and the
seconds left on a rune. A hero walking off the field to rest flipped the key, so on a farming
account "Inputs changed since this plan was computed" showed up every few minutes with nothing a
player would recognise behind it. None of those fields is anything the optimizer reads. The plan
is now keyed to the planning view of the account — levels, stars, points, abilities, runes (axis
and strength, not the clock), gear and its forge, the bag, the tree, the house, the phase, the
setup controls — and to nothing else. On the desktop the header's "out of date" reads from the
same view.

**When it does fire, a ledger, not a sentence.** In place of the one-line notice, a table of every
change since the plan was built: what (the hero or piece, drawn), what moved ("levelled",
"forged", "gone from the bag", "points in Attack"), before → now, and a verdict. **Changes the
plan** is the reason to build again. **Progress on this plan** is a step the plan itself asked
for, taken — a piece forged towards its target, points spent where it said — with the target
beside it. Field rotation is one muted line, "Not counted", never a row. *Keep this plan* folds
the table away until the next change; *Build team plan again* is the same press as the setup
panel's.

A plan restored from a previous visit on the web carries no record of what it was built from, so
it keeps the one-line notice.

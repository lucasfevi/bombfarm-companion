---
"@bombfarm/domain": minor
"@bombfarm/web": minor
---

Show the gear an Optimizer plan takes OFF a hero, say why, and let you plan without the reason.

The plan could always unequip a piece and hand it back with nobody taking it, and the page rendered
no row for it: the item vanished off the hero's card and was mentioned nowhere, because the
"returns to inventory" group the model already built was filtered out before it reached the screen.
Those removals now appear on the hero they came off, and carry their reason.

The reason is field crowding. Where the field cannot seat the whole roster at once, a hero taking
more field time crowds the others out, so gear that raises its uptime lowers the roster's own
score — faithfully modelled, and the honest answer to "what does my roster earn as it stands". It
is the wrong answer for a player who rotates heroes in buckets, and it reads as the optimizer
ignoring an item. **Keep every hero geared** drops that term from both objectives, so more gear can
never score worse, and fills every empty slot the plan has an item for. The totals it produces
describe a field that never makes heroes queue, so they read higher than the roster really earns —
the control says so, and the reported field status stays the true one either way.

On a 13-hero roster the honest plan left eleven slots empty that it owned gear for, three of them
helmets; with the toggle on it leaves none, and every remaining gap is a piece the hero is too
low-level to equip.

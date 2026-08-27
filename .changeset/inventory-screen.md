---
"@bombfarm/domain": minor
"@bombfarm/game-art": minor
"@bombfarm/web": minor
"@bombfarm/desktop": minor
---

An Inventory screen that shows every item you own, not just the gear

Both the planner and the desktop app now have an Inventory tab listing everything the account
carries, grouped by kind — gear, gems, keys, materials — with each item's level, forge, set and
slot, what it sells for, and whether it is equipped, stashed, locked, or tradable.

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

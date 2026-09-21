---
"@bombfarm/desktop": patch
"@bombfarm/game-api": patch
---

The Optimizer's "Redistribute points?" dialog no longer reports a hero as "not on the roster any more" when the hero is still there. Right after the equip step, the account's hero stats could arrive one read ahead of its item list; for a hero whose gear had just moved, that read cannot recover the spent points, the hero was held out of the optimizer's own input list, and the dialog was reading roster membership from that list. Two fixes: membership now comes from the whole roster, and a hero whose points the read could not recover stays selectable (the run checks its live allocation on the server before touching it, as it always did); and the account refresh now serves hero stats and the item list only as a pair from one read — a cycle that read one but not the other keeps the last pair it read together, so a hero's spent points are never inverted against gear it no longer wears.

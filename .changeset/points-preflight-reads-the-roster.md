---
'@bombfarm/desktop': patch
---

The Optimizer's "Redistribute points?" dialog no longer reports a hero as "not on the roster any more" when the hero is still there. Right after the equip step, the account's hero stats can arrive one read ahead of its item list; for a hero whose gear just moved, that read cannot recover the spent points and the hero is held out of the optimizer's own input list, and the dialog was reading roster membership from that list. Membership now comes from the whole roster; a hero whose points the read could not recover stays selectable, and the run checks its live allocation on the server before touching it, as it always did.

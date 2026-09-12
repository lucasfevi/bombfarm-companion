---
"@bombfarm/domain": minor
"@bombfarm/web": minor
"@bombfarm/desktop": minor
"@bombfarm/farm": minor
"@bombfarm/hero": minor
---

Price team auras one way on every screen, and give a hero's own screen its switches.

**The same hero printed a different DPS on every screen, and a different one on every account
read.** The Heroes screen and the planner's Combat tab priced team auras off a snapshot of
whoever happened to be standing on the field when the account was read, so the number moved as
the rotation turned — on one real roster it read 22–33% low for every hero, on another 4.7% high.
The Optimizer's damage objective summed each carrier's rank by its duty and clamped afterwards,
which held two part-time carriers of one capped aura at the cap the whole time; the gold
objective and the Farm board took the expected value of the capped sum instead.

**Every screen that rotates a roster now prices auras the Farm board's way**: each carrier the
game will field, weighted by the uptime the model predicts for it, the cap taken inside the
expectation. The Optimizer's damage objective moves onto it — on a roster with one carrier per
aura nothing changes; three Fôlego carriers that summed to 60 against a cap of 20 move a plan's
DPS by −3.7%. The phase explorer beside the Farm board prices the same way, on both apps, so it
and the board agree.

**A hero's own screen asks a narrower question, and gets a control.** The Heroes screen and the
Combat tab price one hero on the field: its own aura always counts, and every other carrier is a
what-if behind a switch — off, the hero is priced alone; on, that aura counts every other hero in
rotation that carries it, as if they stood on the field the whole time. The four switches sit
beside the phase picker, say what they assume, and say where the uptime-weighted figures live
instead. They reset on every visit, like the phase pick.

**The stored aura total is gone.** The planner used to keep a hand-typed override that no screen
has offered a field for since August, and a snapshot that went stale on the next read; a saved
account still carrying either loads with both discarded. A Farm board that was still being priced
against such an override — a number no control could show or clear — now prices the roster like
every other.

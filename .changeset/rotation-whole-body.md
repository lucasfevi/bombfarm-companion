---
"@bombfarm/contracts": patch
"@bombfarm/domain": patch
"@bombfarm/game-api": patch
"@bombfarm/desktop": patch
---

Keep per-hero rotation state, and stop a cosmetic shape change from blanking a whole account section

The `/rotation` read used to keep only its `casa` (house) sub-object and discard the rest of the
body — the field list and, most importantly, each hero's in-field/energy/recovery state, even
though that state was already being validated. That data now reaches storage.

Separately, any account section whose response shape drifted from what this app expects (a game
update adding or removing a field) used to be dropped entirely for that cycle, even when the data
that mattered was still there — a mismatch was correctly detected, but the section was then
processed as if the source hadn't answered at all. A drifted section that still holds a usable body
is now kept and reported as degraded (naming the keys that changed), rather than discarded. A
section that lost the very data it needs still reports missing, unchanged.

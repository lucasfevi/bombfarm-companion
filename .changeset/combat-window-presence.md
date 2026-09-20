---
"@bombfarm/domain": patch
"@bombfarm/desktop": patch
---

The Skill Tree's "DPS at gate" and "Duel DPS" figures no longer credit max energy when every
squad hero already lasts the whole window. Auras, Matilha's allies and the Baton Pass pulse are
now weighted by the share of the window each hero fields — the squad deploys full when it opens
— rather than by its farm-rotation duty, which let a longer stint lift every ally's damage and
price an energy node as if it fought. A Baton Pass carrier now pulses once at the open, so its
pulse lights the whole minute of a duel and the first 120 s of a gate clear.

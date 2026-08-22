---
"@bombfarm/domain": patch
"@bombfarm/contracts": patch
"@bombfarm/game-api": patch
---

Add rotation status classification: field, recovering, queued, and benched

`@bombfarm/domain` now exposes `classifyRotation`, which sorts a normalized `/rotation` snapshot's
heroes into four lists — on the field, recovering at the house, queued for a house slot, and
benched — plus an occupancy count and the house panel's read-only figures (active house level,
slots, cycle time, rescues). Classification keys off each hero's own activity, never off whether
the game currently has them parked at the house: a benched hero and a queued one can both sit at
the house at the same time, so that flag alone cannot tell them apart. Each recovering hero also
carries its own remaining recovery time, derived from the house's cycle length and how full its
energy is.

The rotation vocabulary also gains the fourth hero state the game reports — fully recovered and
waiting for a field slot. It was previously unrecognised, which cost a hero its activity; it now
reads as its own state and is listed alongside the heroes queued for a house slot.

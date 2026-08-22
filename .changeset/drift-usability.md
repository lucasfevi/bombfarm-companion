---
"@bombfarm/contracts": patch
"@bombfarm/desktop": patch
---

Stop a harmless added field from hiding DPS, next-point ranking and reset advice

A game update that only adds a field this app doesn't read used to be treated exactly like one
that removes a field it does read: either kind of shape drift made the desktop withhold DPS,
next-point ranking and reset advice for every hero, even though nothing the planner actually
needed was missing. Now those two cases are told apart. A drift that only adds fields is
harmless — nothing read was lost, so advice keeps rendering as normal, just flagged as drifted.
A drift that drops a field this app reads still falls back to the last good reading instead of
computing from an incomplete body (and guessing at the missing value), exactly as it did before
shape drift got its own status.

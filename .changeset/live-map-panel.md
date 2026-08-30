---
"@bombfarm/desktop": minor
"@bombfarm/domain": minor
---

Add a Map panel to the Live tab, beside the earnings figures: which map is being played (its
in-game difficulty coordinate, its flavour name and its phase number), how much of the map's
health is left, and how many props are still standing out of the total a fresh map of that phase
spawns.

Every figure comes from the live combat stream and is folded once in the main process, so the
panel only ever formats finished values. Health and the prop count are reported independently —
one absent from a tick reads as "not sent" rather than zero, and a map with nothing left standing
reports zero props rather than a dash. The prop total comes from the phase's own wiki row rather
than from the stream, so it is correct immediately instead of only after the first map completes.

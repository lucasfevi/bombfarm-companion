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

It also reports what the map is worth: XP per prop with the account's own skill-tree multiplier
applied, average gold per prop, and average gold for a full clear. Those three are modelled from
the map's wiki row rather than measured, and the panel marks them as estimates — the measured
gold/hr and XP/hr sit immediately beside them, and the two must not read as the same kind of
number. They come from the same `computePhaseIntelGlobal` the web planner's Phases screen uses, so
a figure cannot say one thing on the Live tab and another on Phases.

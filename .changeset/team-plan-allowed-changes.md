---
"@bombfarm/domain": minor
"@bombfarm/web": minor
---

Let the Team plan propose only the kind of change you are willing to make, and tidy the setup bar it sits on.

**Allowed changes.** A plan used to do both things at once: move and forge gear, and re-spend stat points. A new control on the search setup bar offers gear and points (the default, and what every existing plan did), points only, or gear only. It is a different axis from Hero scope, which decides which heroes the search may touch rather than what it may do to them, and it is honoured under both objectives.

The restriction reaches the search itself rather than the results on screen. Points only skips the gear climb, drops the forge floor to zero, and runs the search from the roster exactly as it stands, so the plan comes back with no move list and no forge list — and the Min forge control leaves the setup bar, since a floor a plan is never scored at is a control that does nothing. Gear only skips every stat-point pass, so no point reset can survive into the plan. A restricted plan says so in Assumptions & limits, which matters because an empty forge list otherwise reads as "forging did not pay" when it means "forging was never on the table".

**Layout.** The forge stepper's `−` and `+` were 24px tall next to 34px fields, and rendered at the field label's 11px uppercase type because they inherited it; they now match the row. The Build team plan button was pinned to the bottom edge of the setup row — which is wherever the longest hint under a field happens to end — and now sits centred against the fields, 33.75px higher on the reference build.

**Copy.** The phase picker's search box said "Difficulty, coordinate, or number", which named a thing the game does not call a coordinate; it now shows one example per route — `Hard, Normal 2-1, or 151`. The setup panel's own sentence no longer promises gear moves, forge work and point resets up front, since the new control decides which of those a plan may contain.

---
"@bombfarm/domain": patch
"@bombfarm/web": minor
---

Correct the House recovery timers and give the Account its own page

The `HOUSES` table was a whole-minute reconstruction and every endpoint was short of the real
cycle — Casa I ran 19→17 min against a true 20→19, and Casa V ran 7→5 min against a true 11→10,
nearly half the real recovery time. The wiki publishes the exact figures per house
(`cycle_secs_base`/`cycle_secs_max`), and interpolating those reproduces a captured in-game
countdown of 1168.42 s at Casa I level 11 to the rounded second, which the old table missed by
91 s.

Because House rest sets how much of a rotation is spent refilling rather than on the field, this
moves every duty-cycle-derived number for anyone whose save did not carry its own `casa.cycle_secs`
— sustained DPS, farm rate, clear time, the team-plan score, and the next-point ranking (a point
of Energy is worth more against a longer cycle than it used to be). The per-house recovery-slot
ladder is corrected from the same source: Casa II and Casa III were listed at 6 and 9 slots and
are really 5 and 7.

The Account panel is now a page of its own at `/account`, reachable from the site nav, and leaves
the planner's tab strip — the planner keeps Abilities, Gear and Points. Alongside the existing
House, Farm, Skill Tree and Team buffs controls, the page adds a "From your save" panel for the
account-wide values the save already carried but nothing outside the import dialog ever showed:
furthest phase reached, flat Luck and the XP multiplier from the skill tree, the two different
slot counts (field slots vs House recovery slots, which are genuinely different numbers), and the
House countdown recorded in the save with the house and level it was captured at.

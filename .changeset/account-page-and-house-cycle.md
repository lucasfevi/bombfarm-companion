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

A second correction rides along: House level 0 (a house you have not unlocked) used to extrapolate
BELOW the level-1 base, inventing a cycle longer than the house can ever have. The game reports the
base for such a house, so the level is now clamped to 1..20.

The Account panel becomes a page of its own at `/account`, reachable from the site nav, and leaves
the planner's tab strip — the planner keeps Abilities, Gear and Points. It is rebuilt the way the
Farm page is, as small focused sections instead of one long panel:

- **A header** naming the account: player name, account ID, current phase and furthest phase. The
  first two come from `account.player_name` / `account.account_id`, which are optional export keys
  the app never read before; a save without them shows dashes rather than a blank header.
- **A House section** with the current House and its level as `13 / 20`, its recovery cycle and
  recovery slots — and what the next House gives you at its own level 1, so the upgrade is a
  comparison rather than a guess.
- **A Skill Tree section** mirroring the game's own Bonus summary, including the part the game
  leaves implicit: Total damage is not a third independent bonus, it is `(1 + squad damage) ×
  multiplicative damage`, and the panel prints that working. Luck and the XP multiplier moved here,
  and field slots show both the tree's bonus and the usable total (they differ by exactly one).

The farm-phase field, the target-prop picker and the team-buff fields are gone from the page along
with the strings and components that served only them; the page is now entirely read-only,
import-sourced facts. Note that a stored team-buffs override is still honoured by the farm-rate
math — nothing can author a new one, so an account that set one before keeps it with no UI to
change it.

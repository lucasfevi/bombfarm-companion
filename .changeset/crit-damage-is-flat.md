---
"@bombfarm/domain": patch
"@bombfarm/web": patch
---

Fixes crit damage: it is **flat-additive**, not a percentage of the hero's crit-damage roll. Both
the sheet ability and the stat point were modelled as shares of the roll; both are flat, and the
error was large enough to make the planner invent points a hero cannot hold.

- **Golpe Brutal** grants **+4 crit-damage percentage points per level**, flat — not 4% of the
  roll. Ivo (id `21076`, L38, 20/20, zero unspent points) moves from `birth_stats.crit_dmg`
  1.45238210566148 to `stats.crit_dmg` 2.25238210566148: exactly `+0.8 = 20 x 0.04`.
- **A crit-damage stat point** grants **+5 percentage points**, flat — not 8% of the roll. Two
  heroes with different rolls, each holding exactly 2 such points, move their sheets by the same
  +10.0: Bellatrix L42 off a roll of 66.252971472748, and a second hero off 67.127583786901. A
  share of the roll would have to produce two different deltas.

**Why heroes were showing impossible builds.** A hero is granted one stat point per level, so its
spend can never exceed its level. Modelling Golpe Brutal as percent-of-base left an unexplained
residual on the crit-damage line, and point inference charged it to spent points: Ivo came out at
**50 points on a level-38 hero**, all 12 of the excess in crit damage. The respec advisor budgets
off that number, so it would have proposed a 50-point build for a hero that can hold 38 —
unbuildable advice. Both now reconcile exactly.

**Also fixed by the same change**: Bellatrix L42's long-standing crit-damage inference issue,
previously documented as an unresolvable "known inference ambiguity" in the fixture corpus. It was
this unit error; she now solves to exactly 2 crit-damage points, and every hero in every committed
capture is inference-issue-free.

What moves in the planner: any hero holding crit-damage points has a slightly different crit-damage
sheet value (now matching the game's own export exactly), and the marginal value of a crit-damage
point changes for every hero — it rises for heroes whose roll is below 62.5 and falls for those
above, since the gain no longer scales with the roll. Next-point rankings, the crit-damage stat
breakdown and DPS figures shift accordingly.

**Historical note, for anyone comparing against older captures**: crit damage genuinely WAS a
percentage of the roll before the 2026-08-13 patch, and the old model fit those saves exactly. The
patch changed the shape; every capture since is flat.

**Local data migration.** If you already have a hero saved with Golpe Brutal spent, its stored
crit-damage sheet value was baked under the old (multiplicative) model and would otherwise be
misread under the new (flat) one — the Stats panel's Birth column would show the wrong roll, and
setting Golpe Brutal back to 0 would silently rewrite the misread value into storage. The web
planner now runs a one-time, one-shot conversion on your existing local roster the first time you
open it after this update: it recovers each hero's original roll from the old bake and re-bakes it
under the new flat model, so the sheet keeps showing the same hero you already had. Heroes without
Golpe Brutal are untouched. This runs automatically; there is nothing to do.

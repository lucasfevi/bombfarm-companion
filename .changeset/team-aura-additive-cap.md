---
"@bombfarm/domain": minor
"@bombfarm/web": minor
---

Fixes four compounding errors in the team-aura model, confirmed against the maintainer's own
roster: **team auras stack additively across every carrier on the field, then clamp at that
ability's own maximum** — two rank-20 Fôlego de Mineiro carriers give −20%, and two rank-10
carriers give the same −20%, never −40% and never −20%×2.

**Contra o Relógio was never a team aura.** The wiki's `kind` prefix (`gate_power`, not the
`team_*` every genuine aura carries), its own "Só ele" scope column, and this catalog's
`effectText` (missing the "do TIME" every real aura has) all agree it is self-scoped — a hero's
own gate-phase attack bonus, not a team-wide one. It is removed from `TEAM_BUFF_ABILITY_IDS` /
`TEAM_BUFF_FIELDS` / `zeroTeamBuffs()`; `gateAttackMult` now reads the hero's own ability ranks
alone. This was a live double-count reaching the shipped gate advisor, not an inert modelling
gap. A stored roster's `teamBuffs` blob may still carry an old `contra_relogio` key — it is a
loose `Record<string, number>`, so the orphaned key is read harmlessly and never again.

**A hero's own rank was double-counted against the team total.** `abilityMods` folded a hero's own
Grito de Guerra / Marcha Acelerada / Fôlego de Mineiro rank into an already-combined multiplier,
and the team term was then stacked on top of that — so a carrier's own investment counted twice
once any other carrier was on the field, while a non-carrier (or a roster with the aura at its
default zero) read correctly by accident. Presságio Mortal had the same defect in a different
shape: its team term was capped on its own, then a hero's own Presságio rank was added back on
top, uncapped — a hero maxing Presságio while standing with other maxed carriers read 228.57% of
base against a 114.29% cap, exactly double. `AbilityMods` now exposes Fôlego's own contribution
separately (`ownTeamDrainPct`, decoupled from Bateria Extra's self-only `drainMult`, since the two
abilities share an effect kind but not a cap), and the combination site
(`combineTeamAuraPct`, `derive.ts`) adds a hero's own rank to the other carriers' total and clamps
the COMBINED figure once, for all four auras — never a pre-folded multiplier (or a second,
independent additive term) stacked on top of an already-capped team total. The now-redundant
`combatCritChancePctOfBase` input to `derive()` is removed; `teamCritPctOfBase` alone carries the
fully combined, capped Presságio figure, matching how `attackMult`/`speedMult` already carried
Grito/Marcha's combined totals.

**The cap was global and five times too generous.** `stackTeamBonusMult` clamped every aura at a
single +100% figure attributed to a `combate.team_mult_bonus_cap` wiki key that does not exist —
not in the live wiki payload, not in this repo's own drift capture. The real cap is per ability
(`TEAM_BUFF_CAP`): Grito de Guerra and Fôlego de Mineiro cap at 20, Marcha Acelerada at 3.7,
Presságio Mortal at 114.28571428571428 — each ability's own rank-20 maximum, not a shared
constant. `computeTeamBuffsFromDeployed` and Presságio's team-crit term now clamp at the same
per-ability figures; five fielded rank-20 Fôlego carriers used to drive drain to a 100×-optimistic
floor, and now cap at one carrier's worth.

**What moves in the planner**: any roster with two or more carriers of the same team aura sees a
lower (correctly capped) bonus than before; a roster with at most one carrier per aura and no
Contra o Relógio contribution to the gate advisor is unaffected. Farm-board duty-cycle figures for
multi-carrier rosters fall roughly 3-4% versus the previous (double-counted) model — a shift in
degree, not a collapse.

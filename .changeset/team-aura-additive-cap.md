---
"@bombfarm/domain": minor
"@bombfarm/web": minor
"@bombfarm/desktop": minor
---

Fixes five compounding errors in the team-aura model, confirmed against the maintainer's own
roster: **a team aura is a property of the FIELD, not of any one hero.** Every deployed hero —
carrier or not — experiences `min(cap, Σ every carrier's rank)`. Two rank-20 Fôlego de Mineiro
carriers give −20%, two rank-10 carriers give the same −20%, and a non-carrier standing next to a
rank-20 carrier also reads −20% — never −40%, never −20%×2, and never 0% just because it happens
to be a non-carrier.

**Contra o Relógio was never a team aura.** The wiki's `kind` prefix (`gate_power`, not the
`team_*` every genuine aura carries), its own "Só ele" scope column, and this catalog's
`effectText` (missing the "do TIME" every real aura has) all agree it is self-scoped — a hero's
own gate-phase attack bonus, not a team-wide one. It is removed from `TEAM_BUFF_ABILITY_IDS` /
`TEAM_BUFF_FIELDS` / `zeroTeamBuffs()`; `gateAttackMult` reads the hero's own ability ranks alone.
This was a live double-count reaching the shipped gate advisor, not an inert modelling gap. A
stored roster's `teamBuffs` blob may still carry an old `contra_relogio` key — it is a loose
`Record<string, number>`, so the orphaned key is read harmlessly and never again.

**A hero's own rank was double-counted against the team total.** `abilityMods` used to fold a
hero's own Grito de Guerra / Marcha Acelerada / Fôlego de Mineiro / Presságio Mortal rank into its
own combat mods, and the team's total was then stacked on top — so a carrier's own investment
counted twice once any other carrier was on the field. `abilityMods` no longer touches any of the
four team auras at all: they are accounted for ENTIRELY through the roster-wide total, which
already includes every carrier, this hero included. The four abilities that share an effect kind
with a genuine self ability (Fôlego/Bateria Extra on `drainPct`, Presságio/Olho Clínico on
`critChancePctOfBase`) now split cleanly on ability id/`onSheet`, not on a shared, pre-folded
multiplier.

**`computeTeamBuffsFromDeployed` used to exclude one hero, so the total every OTHER hero read
depended on who that was.** With one rank-20 carrier, excluding it left every other hero reading
0% where the rule gives 20% — a UI-state-dependent answer to a question that has nothing to do
with UI state. It no longer takes an `excludeHeroId`: it sums every deployed hero, excluding
nobody, and returns the RAW total (the cap applies once, at the combination site
`computeCombatMults`, so the stored/displayed figure can still show a true over-cap sum). The
planner's hero editor needed the old exclusion to make a live rank edit move that hero's own DPS
preview; it now gets the same effect from `substituteHeroAbilities(total, oldRank, newRank)` —
substituting the edited hero's own contribution into the stored total instead of ever excluding it.

**The cap was global and five times too generous.** The old cap clamped every aura at a single
+100% figure attributed to a `combate.team_mult_bonus_cap` wiki key that does not exist — not in
the live wiki payload, not in this repo's own drift capture. The real cap is per ability
(`TEAM_BUFF_CAP`): Grito de Guerra and Fôlego de Mineiro cap at 20, Marcha Acelerada at 3.7,
Presságio Mortal at 114.28571428571428 — each ability's own rank-20 maximum, not a shared
constant. Five fielded rank-20 Fôlego carriers used to drive drain to a 100×-optimistic floor;
they now cap at one carrier's worth.

**The roster-wide total is now DERIVED by default, not a stored field starting at zero.** Once
`abilityMods` stopped folding a hero's own rank into its own mods (above), the account's
`teamBuffs` value became the ONLY source of any team-aura benefit — and that value defaulted to
an all-zero `zeroTeamBuffs()` that nothing populated on import. A carrier's aura genuinely applied
to nobody, including itself, until a user found the Account panel's auto-fill button by hand: a
regression in shipped default behavior, not a modelling nuance. The farm board and the live
advisor preview now read `computeTeamBuffsFromDeployed(heroes)` — the same pure roster total the
auto-fill button always wrote — whenever the account carries no explicit override, so a fresh
import shows the real total its own roster carries. The Account panel's manual fields remain a
genuine override: editing one, or pressing Reset (an explicit all-zero override, distinct from no
override at all), still pins the account to that exact figure regardless of later roster changes,
exactly as before. A pre-existing local save's stored `teamBuffs` migrates on next load: an
all-zero value (the old ubiquitous, never-touched default) is indistinguishable from "never
touched" and becomes derive-by-default; any value with a genuinely nonzero entry was a real
auto-fill snapshot or hand edit and carries forward as an explicit override, unchanged.

**The desktop app had the same regression, with no button to work around it.** It has no
team-buffs UI at all, so `AccountShared.teamBuffs` there was hardcoded to `zeroTeamBuffs()` as a
placeholder for a dimension it did not model — harmless while a hero's own rank still self-applied
regardless of that placeholder, but not once the self-fold above was removed: every desktop hero,
including a carrier itself, started reading zero team-aura benefit with no way to correct it. The
desktop's advice pipeline now derives the same `computeTeamBuffsFromDeployed(heroes)` total from
its own roster on every rebuild — always derived, no override, since there is nothing on the
desktop for an override to record.

**Internal (no shipped behavior change): the account-486 throughput anchor is retired.**
`farm-rate-486-anchor.test.ts` pinned `goldPerHour` against telemetry captured beside a save that
predates both the 2026-08-15 crit-chance/CDR shape change and the 2026-08-16 item-slot
redistribution — sheet math this repo already declares unreproducible
(`points-within-level-budget.test.ts`'s `NON_CURRENT_REGIME_CAPTURES`). Re-pinning it to whatever
this fix's model now produces would have anchored a fresh-looking number to a stale target, so the
file is deleted rather than recalibrated (issue #137); its fixture stays committed for the
structural suites that still read it for roster shape. A new in-regime anchor,
`farm-rate-phase51-ato2-anchor.test.ts`, pins the same link-by-link chain against a post-revert
capture (`sheet-math/save-20260818-12heroes.json`, phase 51) and 61 freshly-logged clears; its
`heroesOnField`/`clearSecs`/`goldPerHour` carry a documented, left-open ~6-8% residual attributed
to partial team-aura coverage across a farming rotation (issue #138) rather than tuned away.

**What moves in the planner**: any roster with two or more carriers of the same team aura sees a
lower (correctly capped) bonus than before; a non-carrier standing with a carrier now correctly
receives the SAME bonus the carrier does, where it previously received none. A fresh import, or
any account that never pressed auto-fill or edited a team-buff field by hand, now shows its
roster's real team-aura total immediately instead of a blank zero panel. A roster with at most one
total carrier per aura, no Contra o Relógio contribution to the gate advisor, and an explicit
account-level override already on file, is unaffected in shape.

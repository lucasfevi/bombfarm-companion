# ADR-016: One bombing-cadence model behind every DPS figure

**Status:** accepted  
**Date:** 2026-09-11

## Context

The companion printed DPS from two different bomb-cycle models.

The **advisor's** model (`packages/domain/src/model/combat.ts`, `bombsPerSecond`) was serial:
`bombs/s = 1 / (fuse + walk)`, with `fuse = max(2 × (1 − cdr), 0.4)` and `walk` a constant
0.15 s pinned in `farm-context.ts`. Speed did not appear in it. This model fed the planner's hero
strip, the Points panel's next-point ranking, the reset-advice gate, the Combat stage on both the
web planner and the desktop app, and the Optimizer's damage objective (`team-plan/score.ts`). A
`'wiki'` alternative — the wiki's `(0.3 + 0.12 × speed × 0.0386) × sf(energy)` rate — survived
beside it as a `CycleModel` toggle nothing exposed.

The **farm board's** model (`packages/domain/src/farm-rate.ts`, `cycleSecondsForHero`) was
measured: `cycle = E[max(fuse, hop ÷ w)] + latency` over a plant-to-plant hop-length histogram
fitted on 662 attributed hops, with `w = speed × 0.0386` cells/s and the histogram rescaled to each
difficulty band's prop density. Its file header declared an "estimator-only boundary" and promised
never to touch the advisor's serial model.

The split stayed tolerable while the two surfaces answered different questions. It stopped being
tolerable when the Combat tab redesign put **Speed on a card** — a card wired, on the advisor's
side, to nothing. A Speed point ranked at exactly 0% forever; Marcha Acelerada was worth nothing;
and a hero's bombs/s on the Combat stage and its plants/s on the Farm page, for the same phase,
were two different numbers with no explanation between them.

## Decision

The advisor's `bombsPerSecond` becomes
`1 / cycleSecondsForHero(fuseSeconds(cdr), speed × GRID_SPEED_COEF, ato)`, where `ato` is the
difficulty band of the phase being priced (`phaseMapCoord(phase).ato`), carried on `Context` as
`ato`. `farmContextForHero` derives it from the farm phase exactly as it already derives
mitigation; an unset phase prices at phase 1's band, as it already prices at phase 1's mitigation.

The serial model is **removed, not kept as an option**: `CycleModel`, `Context.cycleModel`,
`Context.walkDelay`, `FARM_CYCLE_MODEL` and `FARM_WALK_DELAY_SEC` are gone, and with them the
`'wiki'` branch and its stamina factor, which had no reader once serial was the only live value.

The histogram, its constants and `cycleSecondsForHero` move to `packages/domain/src/model/cadence.ts`
so `model/combat.ts` can import them without a dependency on the farm estimator; `farm-rate.ts`
re-exports them unchanged, so its callers and tests do not move. Its boundary header is rewritten:
the cadence model is shared, and `farm-rate.ts` adds only the per-band precompute.

`marginalFuseSeconds` — the linear no-floor fuse the next-point ranking uses to score a CDR point
before the cap — feeds the same cycle, through `sustainedDpsWithFuse`.

## Consequences

- **Every DPS figure changes, on both apps.** Sustained and active DPS, the hero strip, the Points
  ranking, the reset gate, the Combat stage breakdown, the Optimizer's damage objective and the
  Phases page's solo-DPS table all move, downward at typical sheets (the serial cycle ran ~1.4×
  faster than the measured one at 40–70% CDR). Every pinned expectation — Vitest goldens, the
  team-plan damage golden, the clear-time ratio, the e2e gate figures — is re-baselined in the
  same change, each with its reason in the diff.
- **Speed is a real next-point candidate.** It ranks third on every fixture hero (≈1.1% per
  point) and Marcha Acelerada is worth something. Correspondingly, **CDR pays only on the hops
  where the fuse is the longer leg**: a shorter fuse does nothing for a hop the hero would spend
  walking anyway. That was observed directly on 2026-09-12 — two heroes fielded alone, one of
  them respecced from 11.9% to 28.3% CDR with gear held, the other as control, every plant timed
  from its bomb's own fuse: a hero that reaches its next target before its previous bomb goes off
  waits on the cell and plants at **fuse + 0.20 s**, one that arrives later plants at
  **arrival + 0.23 s**; the waiting plateau in her cycle histogram moved from 1.95 s to 1.62 s
  when her fuse went 1.76 → 1.43 s, the control's stayed at 2.01 s, and the fuse itself was
  `2 × (1 − CDR)` to three decimals. Where the crossover falls depends on the hero's walk speed
  and on the field: the model puts it at ~53% CDR for `w ≈ 2` cells/s and 65–79% for gear-boosted
  speeds, and above it the CDR point scores 0%, where the serial model had it paying through to the
  80% cap. Nothing has been measured past ~28% CDR. The same capture showed the shipped hop
  histogram overstating how much of a fast hero's field is fuse-bound in a sparse field (about a
  quarter of cycles measured against 87–89% implied), so a fast hero's CDR figure reads high, not
  low; and the plant latency is 0.20 s where `cadence.ts` carries a fitted 0.39 that compensates
  for the pooled histogram — a constants finding for a full-roster re-fit, not a structure change.
  A CDR-dumped build still trips the reset gate — harder, in fact. The capture is held out of
  band, not in this repo.
- **The cadence model's approximations now reach per-hero figures.** The hop histogram is fitted
  at one band and scaled to the others by a measured density exponent; the density term runs
  optimistic at the easiest band; the latency and adjacent-hop constants are fitted against squad
  clears. These were farm-board approximations before and are Combat-stage approximations now —
  errors of degree, where Speed-does-nothing was an error of kind.
- **A hero priced alone is priced at squad density.** The histogram describes a field of several
  heroes clearing together, and the advisor applies it to one hero's figures. The Farm page already
  did exactly this per hero; the Combat stage now agrees with it rather than disagreeing for a
  different reason.
- The Bombs/s breakdown prints one formula, `1 / cycle(fuse, walk, band)`, with the substituted
  fuse, walk speed, band and resulting cycle, and the "How the math works" explain text describes
  the measured cycle in both languages.

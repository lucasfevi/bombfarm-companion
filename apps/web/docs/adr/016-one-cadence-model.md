# ADR-016: One bombing-cadence model for every DPS figure

**Status:** accepted  
**Date:** 2026-09-11

## Context

The companion carried two models of how often a hero plants a bomb.

The **advisor** — the planner strip, the Points ranking, the reset-advice gate, the Combat stage
on both apps, and the Optimizer's DPS objective — used the *serial* model: `bombs/s = 1 / (fuse +
walk delay)`, with a constant walk delay. Speed does not appear in it, so a Speed point, a Speed
roll and the Marcha Acelerada aura were all worth exactly nothing to every figure it printed.

The **Farm ranking** used the *cadence* model measured from combat recordings:
`cycle = E[max(fuse, hop ÷ walk speed)] + latency` over a hop-distance histogram per difficulty
band, with `walk speed = Speed × 0.0386` cells/s. There, Speed shortens every hop the fuse does
not already cover. The farm module's header declared an estimator-only boundary — "never touches
the advisor's serial model" — and the glossary's *Cadence model* entry said the advisor keeps the
serial one.

The Combat tab redesign puts Speed on a card wired to nothing. That made the split visible: the
same hero had two bombing rates, and the one a player reads most was the one in which the game's
own speed stat is inert.

## Decision

Every DPS figure the companion prints uses the cadence model. The advisor's `bombsPerSecond`
becomes the farm's `cycleSecondsForHero(fuse, walk speed, ato)` at the difficulty band of the
phase being priced; the serial model is retired rather than kept as an option. The Combat stage,
the strip, the Points ranking, the reset gate and the Optimizer's DPS objective therefore agree
with the Farm page on cadence for the same hero at the same phase.

This ships as its own change, ahead of the Combat tab redesign and the team-aura work that
depend on it, so the moved figures are reviewed on their own.

## Consequences

- Every sustained and active DPS figure changes on both apps, and every test that pins one is
  re-baselined in the same change. Speed becomes a real next-point candidate, and Marcha
  Acelerada is worth something.
- The cadence model's own approximations now reach the per-hero figures: its hop histogram is
  fitted at one difficulty band and scaled to the others, and its density term runs optimistic at
  the easiest band (recorded beside the model). Those are errors of degree; the serial model's
  Speed-does-nothing was an error of kind.
- The cadence model is calibrated on squad clears. A single hero priced alone is priced as if it
  were clearing at squad density — the same reading the Farm page already makes per hero.
- The glossary's *Cadence model* entry no longer says the advisor keeps the serial model.

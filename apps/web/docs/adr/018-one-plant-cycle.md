# ADR-018: One plant cycle, measured, behind both the clear and the per-hero bombs/s

**Status:** accepted  
**Date:** 2026-09-27  
**Supersedes:** [ADR-016](016-one-cadence-model.md) · **Amends:** [ADR-017](017-clear-time-standing-props.md)

## Context

ADR-016 put every DPS figure on one bomb cycle, `E[max(fuse, hop ÷ w)] + 0.39` over a hop
histogram fitted on one account at the easiest band, with hops of 0–1 cell charged a flat 2.44 s.
ADR-017 then priced the Farm board's clear with its own cycle inside `clear-time.ts`, so the app
had two cadence models again.

The first model's two fitted constants floored the cycle at ~0.88 s at any walk speed, capping a
hero at ~1.14 bombs/s even at the 80% cooldown cap. A video of one capped hero on a dense map read
1.55/s. The second model's constants were fitted to clear times, not to plants.

Two full nine-hero fields were then timed plant by plant from the combat stream, on two accounts at
the same 100-prop band after the 2026-09-26 patch: 2,868 clean cycles, each timed exactly from its
bomb's own fuse. The captures are held out of band, not in this repo. Every
measurement below comes from both fields, and each agrees between them before it was pooled:

- A hero waits on the cell and plants 0.17–0.20 s after its last bomb goes off (median), or plants
  0.18 s after arriving. The **mean** overheads, which are what set a rate, are 0.47 s and 0.58 s:
  the tail is waits and detours around other heroes' live crosses. Each account fitted alone gives
  the same pair to within 0.07 s.
- The free hop between props runs 3.8–4.1 cells on a full map, rising to ~4.9 with under ten props
  standing, and it **grows with walk speed** as `w^0.53` — within each account alone, not only
  between them. A faster hero reaches for farther targets.
- Only 8–10% of plants re-bomb from within a cell, on a field needing 2.4 hits per kill and on one
  needing 5.9 alike. The clear model had assumed `1 − 1 ÷ hits`, 60–80%.
- With five or more props standing every hero on the field plants at its full cycle. Under five,
  far fewer do than modelled: about two heroes bomb the last prop, where the clear credited 3.4.
- At this band the shipped model valued cooldown about right in the range players can reach
  (×1.10–1.14 at 28% measured, ×1.10–1.11 modelled). Its error was the level: plants per field
  second ran ×0.71–1.07 of it.

## Decision

`model/plant-cycle.ts` holds the one cycle, `max(fuse + 0.47, hop ÷ w + 0.58)`. It is averaged over
a measured spread of free hops around `(3.77 + 2.93 ÷ √n) × (w ÷ 3)^0.53`, with 9% of plants
re-planting from a cell away. The spread is ten decile multipliers, because the cycle is convex in
the hop and a single mean hop understates what cooldown buys on the short ones.

`simulateClear` prices each step with that cycle, takes its starvation line from the measured tail
(`1.53 n + 0.29` heroes with a target), and reports each hero's plants per second on the field.

`cycleSecondsForHero(fuse, w, band)` is now the inverse of that plant rate for the hero standing in
a reference field: nine copies of itself, a rank-20 cross, four hits per prop, clearing the band's
props. The per-hero surfaces have no squad, so the reference supplies one. Across the two measured
fields' hits-to-kill it moves the rate by ~2%. Results are cached, because a clear costs ~15 µs and
the optimizers price the same sheets thousands of times.

The histogram, its density exponent, `CYCLE_LATENCY_SEC` and `HOP1_CYCLE_SEC` are removed.

## Consequences

- **Per-hero bombs/s lands on the measurement.** Against each hero's plants per second on the
  field, model ÷ measured is 1.00 on one field (0.90–1.13, 9 of 9 within 15%) and 0.92 on the other
  (0.80–1.02, 9 of 10); the shipped model read 1.25 and 1.09. Clean cycles are within 11% for all
  19 heroes with enough of them.
- **Cooldown pays to the cap.** Its worth rises with walk speed and with density. For a `w = 3.4`
  hero at 100 props it reads ×1.11 at 28% CDR and ×1.27 at the cap, against the cycle-swap estimate
  of ×1.10–1.14 and ×1.34–1.36. The model is still ~9% low at the cap, which no hero reaches today.
  "CDR scores 0 past ~53%" is gone.
- **Speed is worth about half what it was** in the DPS next-point ranking, because a faster hero's
  hops lengthen. It drops below energy on some heroes. An older capture of four heroes at the
  easiest band, taken before the patch, recorded faster heroes hopping *shorter*. The two current
  fields both say otherwise, so they win, and the conflict is recorded here.
- **The Farm board keeps its totals and fixes their decomposition.** On the frame-derived inputs
  of the two fields, clear time moved 30.0 → 31.8 s (measured 27.5) and 60.7 → 66.9 s (measured
  72.0). The phase-51 anchor, captured before the patch and held out, reads clear −4.2% and gold/h
  −0.5% (+9.7% and −13.1% before). That anchor is still a cancellation: presence reads 7% low and
  cadence 7% high.
- **What is still open is on the damage side.** The second field's clear runs 8% fast because its
  hits-to-kill reads low, which is the same open item as the Baton Pass pulse's damage sensitivity.
  Bands 4–5 are extrapolated: nothing denser than 100 props has been timed plant by plant.
- Every pinned figure that moved was re-pinned in the same change, with its previous value in the
  diff, including the optimizer phases, the frontier, the plateaus, the next-point goldens and the
  anchor. The two-stage phase screen's known misses retired themselves: the two sweeps now agree on
  every state the corpus visits.

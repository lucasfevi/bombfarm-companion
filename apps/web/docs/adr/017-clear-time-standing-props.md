# ADR-017: Clear time is an integral over the props still standing

**Status:** accepted  
**Date:** 2026-09-19

## Context

The Farm board and the Optimizer priced a map as a constant kill rate: each hero's plants per
second (ADR-016's cadence at the band's density) times a fixed hits-per-plant, divided by the
hits-to-kill of a **crit-averaged** hit, summed and divided into the prop count, plus a fixed head.

Measured against two accounts farming the same 100-prop phase, that row failed in both directions
at once. On a nine-hero field whose average hit one-shots most props it read ~15% fast with the
Baton Pass held at its cap, because the game rolls the crit per hit — a hero whose averaged hit
kills a bush still needs ~1.5 real hits when only the crit does, and the field measured 1.92 hits
per kill where the row priced 1.27. On a damage-bound roster at the same phase it read ~30% slow,
because on a full map a blast cross lands on three to five props, not the 2.25 the row credited.
And the kill rate is not constant inside a clear: it runs from nine props a second with seventy
standing to one a second under ten, and a third of every clear is that tail. A constant-rate row
cannot say what an extra hit is worth, which is exactly what the Optimizer asks it.

## Decision

`packages/domain/src/model/clear-time.ts` prices a clear as the sum of `1 / K(n)` over the
standing props `n`, one prop per step, with:

- hits-to-kill per hero and prop type from a per-hit crit roll (`expectedHitsToKill`, exact);
- hits per plant growing with density, saturating near the cross's reach, and losing the
  targeted prop when it dies to someone else before the fuse ends;
- the hop between plants from the standing density, one cell when the hero re-bombs a survivor,
  and the cycle `max(fuse + overhead, hop / w + overhead)` — the same speed and fuse ADR-016 fixed;
- a starved tail where only `1.9 n + 1.5` heroes have a target, and a walk-in head;
- per-type depletion, so easy props go first and the tail is the tough mix.

The row layer (`farm-rate.ts`) keeps the House allocation and the field queue as the presence
model, runs the integral once per level the entry pulse holds the field at, and blends the levels'
rates. Every consumer of `clearSecs`, `propsPerHour` and `expectedHtk` — both boards, the
Optimizer's farm objective, the phase pin — reads the new figure through the same row.

## Consequences

- Constants are geometry and hero-AI measurements from live frames on one account at two
  densities; the model was then held out against the second account at phases 51, 61, 71 and 151
  and against the first at 51, 52, 91, 101 and the phase-51 anchor. Against the day means of the
  clears those accounts logged it reads 0.85–1.02 on the clean days and 0.74–0.88 on two days
  whose rosters were being changed for captures and duels; the constant-rate row spanned 0.73 to
  1.50 over the same pairs. None of the constants is fitted to one account's gold figure.
- The Baton Pass chip now buys ~14% clear time on a saturated field and ~37% on a damage-bound
  one; the measured figures are ~0% and ~25–30%. The damage sensitivity is still high, which is
  the next thing to measure: a pulse-off run on the saturated account would pin it.
- The phase-51 anchor test is re-pinned to the new arithmetic and its residual restated; it is
  not refitted.
- A row costs ~25 µs against ~4 µs before (the integral steps `n / 10` props at a time above ten
  standing and one at a time below, with one exponential per pass), so a 600-row board is ~15 ms.
  The domain test suite, which the optimizer tests dominate, takes about twice as long.
- Each hero's share of the gold is its share of the clear's kills, which the integral now
  reports (`killShareByHero`); the Veia de Ouro mix follows it rather than the old per-hero rate
  terms.
- `clearHeadSeconds`, the hop histogram and the ato rescale stay exported for the per-hero DPS
  surfaces and their tests; the row no longer reads them.

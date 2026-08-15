---
"@bombfarm/domain": patch
---

Farm cadence: average the bomb cycle over a measured hop distribution instead of collapsing to a single expected hop.

The estimator computed `cycle = max(fuse, E_D_CELLS / w)` with `E_D_CELLS = 4.5`. That collapses the
plant-to-plant hop distribution to its mean **before** applying `max()`, which is convex — so by
Jensen `E[max(fuse, hop/w)] > max(fuse, E[hop]/w)`, and inverting the result to a rate compounds the
same bias a second time. Cadence ran ~25% fast, and every downstream rate with it.

The measured mean hop is 4.77 against the retired constant's 4.5, so the old number was barely wrong.
Averaging first is what cost the 25%: the distribution's thin tail (hops >= 15, ~3% of plants) carries
most of the cycle time and a mean discards it.

`E_D_CELLS` is replaced by `HOP_DISTRIBUTION` (a 26-bucket pmf), `CYCLE_LATENCY_SEC`,
`HOP1_CYCLE_SEC` and `cycleSecondsForHero()`. Cadence remains phase-independent, so it stays a
per-hero fact computed once — no per-row cost and no new pipeline calls.

Against live bot telemetry on the account-486 anchor (159 clears at phase 26), the estimator now
lands within 3%, and two quantities that were never fitted corroborate it:

| | before | after | observed |
| --- | --- | --- | --- |
| gold/hr | 498,898 | 361,176 | 371,263 |
| clear time | 77.3 s | 106.8 s | ~107 s |

**This changes point-allocation advice, not just the farm board.** Two consequences worth knowing:

- **CDR is no longer worthless for farming.** The old model put every plant on the walk branch, so a
  shorter fuse could never change the plant rate and `cdr` scored exactly 0. Roughly 45% of a slow
  hero's plants are short enough to be fuse-bound — observed live as a flat cycle floor across hops
  2-4 — and on those a CDR point does buy cadence.
- **Energy overtakes Speed** on the fixture roster (speed's marginal value falls ~41%, energy is
  unchanged), because speed buys nothing on that same fuse-bound mass. The respec optimizer's
  winning build shifts toward energy accordingly.

Known limitation: one shared distribution cannot express that heroes have individually different hop
distributions (faster heroes get shorter hops). Against each hero's own measured distribution the
model lands within 1%; against the pooled one it spreads to +-9%, weighted MAE 4.8% — still 5x better
than the 25.6% the retired constant produced. Making the distribution depend on walk speed is the
next refinement and needs captures from more than one account.

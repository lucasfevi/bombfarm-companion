---
"@bombfarm/domain": minor
---

Farm rate: scale the plant-to-plant hop distribution to each ato's prop density.

`HOP_DISTRIBUTION` is measured on an ato-1 map (50 props) and was applied unchanged to every
ato. Denser atos pack props closer, so a hero walks less between plants — applying the sparse
histogram to a dense map over-predicts hop length and under-predicts throughput. Hop length now
scales by `sqrt(props_ato1 / props_ato)`, identity at ato 1 and 0.816x at ato 2.

Clear time falls on atos 2–5 and every rate derived from it rises: gold, chests, keys, gems,
time pieces, stone chests and XP per hour. Ato 1 rows are unchanged. The effect grows with
density — roughly 10% faster clears at ato 2 up to 25% at ato 5 — and is bounded, because the
cycle is `max(fuse, hop/w)` and most of the histogram already sits under the fuse floor.

Validated against live telemetry at phase 51 (ato 2), where the row moves from 1.15x off the
measured gold/hr to 1.05x, and the new `farm-rate-486-ato2-anchor` suite pins it.

Open residual and the blocked ato-2 anchor are tracked in issue #132.

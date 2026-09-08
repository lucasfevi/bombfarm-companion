---
"@bombfarm/domain": patch
---

Charge every clear for the seconds the squad spends coming up to speed, and derive the hourly rates from the clear time rather than from the steady-state prop rate. **Every gold/hr, chest/hr, key/hr, gem/hr and XP/hr figure the Farm board prints goes down** — they were running high, and by more than the size of this correction suggests, because the error was cancelling against a second one.

A clear does not start at full throughput. Heroes activate one at a time down the field roster, 0.500s apart, so the last hero of a nine-strong roster is not moving until 4.0s; and the first bomb planted burns its whole fuse on an empty field, killing nothing for another ~1.8s. Measured head latency is 3.93s median over 42 clears, against 3.96s the model now predicts for that roster size. None of it was charged anywhere: the cadence model's latency terms are per-bomb and the fuse only ever reached it overlapped with the walk to the next plant.

Across the committed captures the median row loses between 0.6% and 11.3% of its gold/hr, largest on strong rosters. The term is a fixed cost per clear, so it hurts fast clears far more than slow ones — 21.9% at the fastest unlocked row on a 13-hero capture against 0.5% at its slowest — which systematically pushes recommendations toward higher phases. One capture's recommended farm phase moves 69 to 73, and another's 31 to 51.

The throughput anchor moves from 7.5% above its measured gold/hr to 6.2% below it. That is a smaller number hiding less: the old +7.5% was a 7% concurrency shortfall multiplying a 15% cadence overshoot, and what remains is the concurrency term alone.

---
'@bombfarm/domain': minor
'@bombfarm/web': patch
---

Farm board and Optimizer clear time is now an integral over the props still standing, with crits
rolled per hit. The old row priced a constant kill rate from a crit-averaged hit, which read a
saturated nine-hero field ~15% fast with the Baton Pass held at its cap and a damage-bound field
~30% slow at the same phase. The new model tracks hits per plant against density, plants that
miss a target that already died, the starved tail under ten props and the walk-in at a wave's
start, and depletes easy props first. Measured on two accounts across phases 51–151 it sits
within ±10% of the clears they logged.

---
'@bombfarm/domain': patch
'@bombfarm/desktop': patch
---

The Optimizer's Reset points step counts only the points it places. A hero whose plan adds points without a respec was shown placing every point it had ever earned — a level-56 hero with one free point read "place 56 unspent points" in the confirm and the step ledger; it now reads 1, matching the per-stat allocation beneath it.

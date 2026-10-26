---
"@bombfarm/desktop": patch
"@bombfarm/game-data": patch
"@bombfarm/contracts": patch
---

The Live screen now credits each bomb to the hero standing on its cell when it is planted, instead of guessing from the bomb's fuse time. Late in a run, when several heroes share the same capped fuse time, damage could be credited to a hero who was nowhere near the bomb. When two or more heroes stand on the same cell and nothing tells them apart, the damage now counts as unattributed rather than going to the wrong hero.

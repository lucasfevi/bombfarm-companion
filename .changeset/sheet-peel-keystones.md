---
"@bombfarm/domain": patch
---

Fix `peelSheetSources` dropping all three keystone sheet effects, which broke its documented AC-10 sum identity on keystone accounts — energy by a factor of 2, speed by ~0.80x and crit damage by 0.72–0.85x. Both keystone contributions land on the skill-tree line, matching the game's own stat tooltip.

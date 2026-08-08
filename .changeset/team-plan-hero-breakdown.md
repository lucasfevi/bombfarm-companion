---
"@bombfarm/domain": minor
"@bombfarm/web": minor
---

Redesign the team plan's per-hero results as expandable per-hero rows (avatar, rank, rarity, level) instead of a plain table. Expanding a row reveals a detailed breakdown: the per-stat before/after change, the recommended point reset (or a note that none applies), and the hero's proposed final gear — shown at the forge level the plan actually expects (`forgeFloorApplied`), not each item's raw stored upgrade. Large DPS figures across the results page are now abbreviated (e.g. `1.9bi`) with the exact value in a themed tooltip on hover/focus.

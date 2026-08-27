---
"@bombfarm/web": minor
"@bombfarm/desktop": minor
"@bombfarm/game-art": minor
---

The Live screen's hero row now shows the hero's level, matching the three-line identity block
(rank+name / rarity / level) the web planner already shows for a rotation-pool hero — previously
the row stopped at rarity.

Under the hood, that three-line block is now one shared component (`HeroIdentity`, new in
`@bombfarm/game-art`) built from primitives rather than a full hero record, so the Live screen (a
partial, streaming roster join) and the web planner (a complete `HeroRecord`) render identical
chrome from the same source. `HeroIdentityChip` is now a thin adapter over it for `HeroRecord`
callers; its own rendered output for the web planner is unchanged.

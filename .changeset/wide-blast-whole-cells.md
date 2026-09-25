---
"@bombfarm/domain": patch
"@bombfarm/hero": patch
"@bombfarm/web": patch
"@bombfarm/desktop": patch
---

Wide Blast (Explosão Ampla) now reaches whole cells only, the way the game does. The game adds 0.1 of a cell per level but banks the fraction until it makes a full cell, so the blast reaches one extra cell from level 10 and two at level 20, and nothing in between. The farm and DPS figures used to credit the fraction, so a partly levelled hero hit more props per bomb than it does in the game: 1.95 blocks per bomb at level 9 where the game gives 1.5 (+30%), and 2.25 at level 15 where it gives 2.0 (+12.5%). Gold, XP, clear time and active DPS for those heroes now come down to match. Heroes at level 0 or 20 do not change. The ability's description and the hero breakdown now say that the range steps up at levels 10 and 20.

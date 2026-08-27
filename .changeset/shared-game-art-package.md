---
"@bombfarm/web": minor
"@bombfarm/desktop": minor
"@bombfarm/domain": minor
"@bombfarm/game-art": minor
---

Desktop Planning now shows the same hero art as the web planner: a rarity-tinted avatar in the
roster list and on the selected hero's detail card, plus the rarity label coloured to match. The
hero-avatar/rank/rarity/gear/ability icon components moved out of the web app into a new shared
`@bombfarm/game-art` package so both apps render identical chrome; the web planner's own call
sites are unchanged.

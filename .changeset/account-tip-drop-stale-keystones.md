---
"@bombfarm/web": patch
---

Fix the Account panel's damage tip (`accountTip`, EN and PT-BR): it still named `Juro` and
`Avalanche`, two keystones the 2026-08-13 patch removed from the game, as examples of the
compounded damage folded into Total damage. Both names are dropped and the sentence is rewritten
around the one surviving example (`GEO`) so it reads naturally in each language, while keeping the
same double-counting warning — Total damage already includes GEO's contribution, so don't add it
again.

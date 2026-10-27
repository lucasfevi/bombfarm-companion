---
"@bombfarm/desktop": patch
"@bombfarm/domain": patch
---

Applying an optimizer plan no longer skips the same hero on every run with "allocation changed". When a stat sits at its cap, its stat sheet cannot show every point placed in it, so the app's reading of that hero's points came up a few short of what the game holds — and every sync read it the same way. The point reset now checks the game's own allocation instead: a planned reset goes ahead whenever the hero owns enough points for the new build, since the reset refunds whatever was placed before.

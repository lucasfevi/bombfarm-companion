---
"@bombfarm/desktop": patch
"@bombfarm/domain": patch
"@bombfarm/contracts": patch
---

Applying an optimizer plan no longer skips the same hero on every run with "allocation changed". When a stat sits at its cap, its stat sheet cannot show every point placed in it, so the app's reading of that hero's points came up a few short of what the game holds — and every sync read it the same way. The point reset now checks the game's own allocation instead: a planned reset goes ahead whenever the hero owns enough points for the new build, since the reset refunds whatever was placed before.

The desktop app now also reads the game's own allocation for those heroes when it syncs the account, so the optimizer plans from the points they really have rather than the short reading. It asks only for a hero whose points the stat sheet cannot account for, and only again once that hero changes.

The optimizer no longer leaves level-up points unspent. Dropping near-worthless changes could undo spending a banked point, so a hero that levelled up was offered the same build every run while its free points piled up; placing a banked point costs nothing, so it now always stays in the plan.

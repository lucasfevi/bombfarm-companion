---
"@bombfarm/game-api": minor
---

The write surface (renamed `forge-request.ts` → `write-request.ts`) now knows six routes instead
of two: equipping and unequipping an item, and refunding or re-placing a hero's stat points join
the existing forge roll, all through the one `requestPost`/`buildWriteRequest` pair and the same
envelope. Nothing shipped sends any of the four new writes yet — the forge run's own call adapts
to the new argument shape with no behaviour change.

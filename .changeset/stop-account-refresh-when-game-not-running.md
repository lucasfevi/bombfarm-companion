---
"@bombfarm/desktop": patch
---

The account refresh cycle now stops issuing requests once the game is closed

The account refresh cycle gated only on player consent and a readable session token file. The
token file persists on disk after the game process exits, so the cycle kept issuing authenticated
requests to the game's servers — every minute foregrounded, every five minutes backgrounded —
long after there was nothing running to talk to.

It now also checks whether the game is currently running, using the same live status the game
reader already reports, and skips the cycle when it is not — consent still gates independently, so
neither check can substitute for the other. The cycle keeps ticking either way, so the very next
run after the game starts back up proceeds normally with no restart needed. Separately, the flag
recorded alongside each commit is now read fresh at commit time instead of a stale literal, so a
cycle spanning the moment the game exits reports that correctly too.

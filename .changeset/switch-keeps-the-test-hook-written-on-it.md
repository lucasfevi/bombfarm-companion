---
"@bombfarm/ui": patch
---

Internal: the Switch control now forwards a `data-testid` to the element it renders instead of
discarding it. Three desktop Settings switches — the one that lets the app forge and equip, the
one that restarts the game if it exits, and the usage count — were written with a test hook that
never reached the page. Nothing a player sees changes.

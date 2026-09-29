---
"@bombfarm/ui": patch
"@bombfarm/web": patch
---

Clearing the hero level field no longer drops the hero to level 0 and rescales the sheet - it can
sit empty while your last level is kept. Levels now hold to 0-500 however they are entered, and a
level already outside that range is shown, and stepped, as the nearest one inside it.

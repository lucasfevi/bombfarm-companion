---
"@bombfarm/ui": patch
"@bombfarm/web": patch
---

Clearing the hero level field no longer snaps the hero to level 0 and rescales the whole sheet. The
field can sit empty while your last level is kept, and every level, typed or stepped, stays within
0-500.

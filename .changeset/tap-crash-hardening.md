---
"@bombfarm/desktop": patch
"@bombfarm/tap-runtime": patch
---

The app is much less likely to crash the game. When it quits, or restarts to install an update, it now waits for its reader to leave the game first, where before it could exit halfway through and take the game down with it. It never loads a second copy of the reader into the game while the first is still leaving, it waits until a newly launched game has finished starting before attaching, and when the game goes quiet it re-attaches less and less often instead of every minute. The log now records why each attachment ended, including when the game itself closed or crashed.

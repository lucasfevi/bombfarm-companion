---
"@bombfarm/game-api": patch
"@bombfarm/desktop": patch
---

Fix every authenticated account read failing. The game's own server moved its API to a new
address and withdrew the old one from DNS entirely, so every request the app made was failing
outright. The app now targets the new address, and the first-run consent screen's privacy
disclosure — which names the address your session token is sent to — has been corrected to match;
what it promises (your token goes only to the game's own server, never anywhere else) is unchanged.

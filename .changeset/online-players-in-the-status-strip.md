---
"@bombfarm/desktop": minor
"@bombfarm/contracts": minor
"@bombfarm/web": patch
---

The status strip now shows how many players are online in the game right now, beside the game
connection, on every tab. It is the count the game's server records, refreshed every few minutes;
the cell stays empty rather than showing a zero when no fresh number is available. The app reads
it from the project's own server, once every five minutes, and the request carries nothing about
you. The privacy policy now lists that request.

---
"@bombfarm/desktop": patch
---

Fix the Live and Inventory tabs falling back to "Loading…" every time you came back to them from
another tab. Both screens set their data up and tore it down with the tab itself, so leaving
dropped the subscription and threw away everything already on screen; returning started over from
an empty screen and waited on a fresh read before it could show anything. Both now follow the game
for as long as the window is open and paint current numbers on the first frame back, with no gap
for whatever arrived while you were away, and no repeated account or price read on each visit.

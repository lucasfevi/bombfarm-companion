---
"@bombfarm/desktop": patch
---

Fix the Live tab falling back to "Loading…" every time you came back to it from Inventory or
Settings. The live stream was set up and torn down with the tab itself, so leaving it dropped the
subscription and threw away everything already on screen; returning started over from an empty
screen and waited on a fresh account read before it could show anything. The stream now runs for as
long as the window does, so it keeps following the game while another tab is showing and the Live
tab paints current numbers on the first frame back, with no gap for whatever arrived while you were
away.

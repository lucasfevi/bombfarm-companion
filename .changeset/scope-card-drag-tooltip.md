---
"@bombfarm/web": patch
---

Removed the hover tooltip on each team-plan scope card's "Lv · #id" text. Its trigger stopped pointerdown propagation to keep the tooltip from firing during a drag, but that same handler blocked a drag from starting if you grabbed the card there — annoying on a board whose whole point is dragging cards between columns.

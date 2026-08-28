---
"@bombfarm/desktop": patch
---

Fix live data no longer appearing on the Live tab. The game's combat traffic changed to a
compressed binary frame instead of the earlier plain-text one, and the app was silently
discarding every frame instead of decoding it — the connection stayed marked "connected" the
whole time, with nothing to show that data had stopped arriving. Both frame shapes now decode to
the same tick, and a payload that still cannot be decoded at all is now logged once per session so
this class of breakage is never silent again.

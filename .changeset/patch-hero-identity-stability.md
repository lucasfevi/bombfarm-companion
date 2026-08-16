---
"@bombfarm/web": patch
---

The Farm board no longer silently discards a valid respec proposal while you are editing a hero.
The 700ms hero autosave rewrote the roster array on every fire — even when nothing about the hero
had actually changed — and the Farm surfaces treat a new roster array as "your inputs moved". The
re-rank switch stayed on but the table quietly fell back to the current build, with no error to
explain it. Saving a hero whose data did not change now leaves the roster reference alone, so a
fresh proposal survives, and every other Farm derivation stops recomputing on a timer.

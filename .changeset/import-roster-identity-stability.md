---
"@bombfarm/web": patch
---

Re-importing a save file that changed nothing no longer discards a live Farm respec proposal. The
import rebuilt the roster array on every confirm, and the Farm surfaces read a new roster array as
"your inputs moved" — the re-rank switch stayed on while the table quietly fell back to the current
build, with no error to explain it. This is the same defect the hero autosave had, on the other
path into the roster. An import whose records all merge to identical data now leaves the roster
reference alone, and every roster write in the planner store goes through a single guard that
declines to replace an unchanged roster. The import summary is unaffected: the created / updated /
removed counts still report what the save file touched, and the merged records are still written to
local storage exactly as before.

---
"@bombfarm/web": patch
---

Say why a hero could not be imported, instead of only dimming it.

A hero the planner cannot rebuild was shown greyed out and nothing else, which states that something is different without saying what — it reads as a rendering glitch, and there is no way to tell whether your account is damaged.

The import dialog now names those heroes and both things that cause it: the save was exported before a game update that changed how stats are calculated, or the game has been updated more recently than the planner has. Each comes with what to do — export a fresh save if the game is still open, and if a fresh save does the same thing, the planner is the one that is behind and an update is on the way. The row itself says it cannot be imported, with that hero's own details in the tooltip, and stays listed rather than disappearing.

Also drops the "Created N · Updated N · Removed N" line from the import dialog. It was bookkeeping from when an import was a merge you curated — the save is the source of truth now, so the split between created and updated is not a decision you make. The one part that cannot be undone stays: if heroes are leaving your roster, the dialog still says so, and only when some actually are.

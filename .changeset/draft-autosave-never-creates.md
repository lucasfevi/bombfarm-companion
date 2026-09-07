---
"@bombfarm/web": patch
---

Stop an import from leaving a hero of the *previous* account in your roster.

The hero autosave is debounced by 700ms. Importing a save inside that window replaced the roster while a write staged against the old one was still pending, and that late write appended its hero to the roster it no longer belonged to — a 4-hero save became 5 heroes, the extra one carrying the id of an account you had just replaced. It was persisted, so it survived a reload.

A draft autosave may now only update a hero the roster still holds. Creating roster entries was never its job.

The visible symptom this was found through: the Farm Respec panel closing itself a moment after you opened it. The roster array is what the board keys its proposal on, so an appended hero silently invalidated a solve you had just asked for.

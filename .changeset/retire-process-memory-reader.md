---
"@bombfarm/desktop": patch
"@bombfarm/game-data": patch
"@bombfarm/contracts": patch
---

Remove the process-memory reading path from the desktop app. The diagnostics snapshot panel now
sources its gold/phase/wave reading from the in-run live data source instead of scanning the
game's process memory directly, and the app no longer depends on a native FFI library to read a
running game's memory. Account data was never sourced from process memory in the first place — it
has always come from the authenticated periodic sync — so this has no effect on account, hero,
skill, casa, or inventory data.

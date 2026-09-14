---
"@bombfarm/desktop": patch
"@bombfarm/ui": patch
"@bombfarm/web": patch
---

Coming back to the desktop Optimizer tab no longer replays the reveal on every row you had open, and no longer rebuilds its snapshot for a wallet tick: the rows are drawn open at once, the scroll offset is back on the first frame, and the account is re-read only when it would change the inputs (a level, a gear change, a different Farm phase). Across the app, a panel that is already open when its screen appears — an accordion row, a collapsed-by-default card you had expanded — is now drawn open; only pressing it animates.

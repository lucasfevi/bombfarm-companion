---
"@bombfarm/desktop": patch
---

Fix installed builds closing themselves a moment after launch.

Every installed build — Nightly, Beta, and stable alike — opened its window, then quit. The
updater is the last thing boot starts, and it failed while wiring its logger, which took the whole
launch down with it. Local development runs were unaffected, because a build with no installer to
replace never starts the updater at all, which is why this reached a release before it was seen.

Boot no longer treats the updater as load-bearing either. An app that cannot check for updates is
still a working app, so a failure there now stops at the Updates section, which says the check
failed, instead of closing the window. It reports a failure rather than the no-channel wording a
local development build gets — telling someone on an installed build that their flavor does not
update would be false, and would hide the problem rather than show it.

Nothing else about updating changes; it now runs where before it stopped the app.

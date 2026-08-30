---
"@bombfarm/desktop": patch
---

Fix installed builds closing themselves a moment after launch.

Every installed build — Nightly, Beta, and stable alike — opened its window, then quit. The
updater is the last thing boot starts, and it failed while wiring its logger, which took the whole
launch down with it. Local development runs were unaffected, because a build with no installer to
replace never starts the updater at all, which is why this reached a release before it was seen.

Nothing about updating changes; it now runs where before it stopped the app.

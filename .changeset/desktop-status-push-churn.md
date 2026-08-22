---
"@bombfarm/desktop": patch
---

Stop the desktop app re-rendering itself twenty times a second

While the game was running, the app rebuilt its whole window on every poll —
fifty milliseconds apart — whether or not anything had changed. Two things
caused it, and both mistook "we read this again" for "this is different": the
status carried the time it was read, and comparing the whole status object made
every read look like a change; the renderer then re-applied that status a second
time from each snapshot push.

Neither the read time nor the re-application is visible anywhere in the app, so
nothing on screen changes — a quiet window now costs about half the component
renders it used to.

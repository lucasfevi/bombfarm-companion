---
"@bombfarm/desktop": patch
"@bombfarm/contracts": patch
---

Notice a new version within twenty minutes of it shipping, instead of within six hours.

An installed app checks the release feed shortly after it opens and then on a timer, and that timer was six-hourly. Opening the app has always been the fast path, so the wait only ever fell on an app left running — which is most of them, for a companion that sits beside the game all day. A release published in the morning could stay invisible until the evening.

Nothing else about updating changes: the check still only *tells* you, downloading is still a button you press, and installing still waits for a restart you choose. That is also why the new interval is twenty minutes rather than one — the notice is worth having sooner, but no amount of extra polling gets a version installed any faster than you decide to install it.

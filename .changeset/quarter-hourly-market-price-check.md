---
"@bombfarm/desktop": patch
---

Check for new market prices every 15 minutes instead of every six hours.

The published price snapshot used to be rebuilt on a six-hourly schedule, and the app's own
re-download interval was set to match it. The snapshot is produced continuously now, so a
six-hour wait tracked nothing — it only meant an app left open could sit on prices hours older
than the ones already published.

The check is conditional, so this costs almost nothing: when the file has not changed the app
sends its copy's validator, gets no body back, adopts nothing and announces nothing, which is
also why nothing on screen flickers on a check that found no news. The per-item refresh button
and the stamp saying how old a price is are unchanged.

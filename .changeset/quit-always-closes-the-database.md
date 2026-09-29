---
"@bombfarm/desktop": patch
---

Quitting the app now always closes its database and writes out its log, even when something goes
wrong on the way down. The shutdown was a single unguarded sequence, so one failing step — a
service that threw while stopping — abandoned every step after it, leaving the database open and
the last of the log unwritten. That log is often the only evidence of whatever caused the failure,
and it was the part most reliably lost. Each step is now contained: a step that fails is recorded
by name and the rest still run, so the database closes and the log reaches disk either way.

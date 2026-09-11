---
"@bombfarm/team-plan": patch
---

Fixed the optimizer screen dropping a finished plan when its search fell back to the main
thread — the run's start was never reported to the host that started it, on either host, so the
finished plan (or the labelled error) never reached the screen.

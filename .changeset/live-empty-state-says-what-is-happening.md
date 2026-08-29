---
"@bombfarm/desktop": patch
---

The Live tab's "nothing read yet" empty state no longer tells you to open the game when it is
already open and the app is simply still attaching — it now states the real reason nothing has
arrived (not yet connected this session, waiting on the game, a runtime issue, and so on), reusing
the same wording already shown once attached. If consent for reading the account is missing, the
empty state now offers the control to grant it again instead of leaving no way forward.

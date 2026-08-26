---
"@bombfarm/desktop": patch
"@bombfarm/tap-runtime": patch
---

Stopping the tap now waits for the read hook to actually be removed

Withdrawing consent stops the tap before the withdrawal is recorded. That stop was only ever
*started*, though: detaching a session kicked off the script unload and returned immediately, so
the app recorded the revoke and told the player the tap had stopped while the injected read hook
was still resident and could still deliver a frame.

Detaching now returns a promise that settles once the unload and the underlying detach have both
finished, and the tap waits for it. Because that wait crosses into the instrumented process, it is
bounded: a runtime that does not answer within a couple of seconds is abandoned with a log record
rather than holding the settings screen open indefinitely. The guarantee is now the one the code
claims, and the one case where it cannot be kept says so out loud.

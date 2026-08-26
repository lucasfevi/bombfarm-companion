---
"@bombfarm/desktop": patch
---

Withdrawing consent stops the live tap on any route out of a granted record, not just the one

Withdrawing consent has always had to stop the tap reading *before* the withdrawal is recorded,
because the tap only consults consent when deciding whether to attach and never re-checks a session
already in progress. That ordering used to live in a single IPC handler, wired for one specific
event, while every other consumer of a consent change was notified from the shared path.

It now lives in that shared path too, and is keyed on the transition rather than on the event: any
record the read gate currently accepts, moving to one it rejects, tears the session down first —
whichever route gets it there. A future second exit from a granted record inherits the guarantee
instead of needing someone to remember it, and the failure it would otherwise have caused, the tap
reading on past the moment permission was withdrawn, is silent — exactly the kind that should not
depend on memory.

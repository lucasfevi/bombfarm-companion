---
"@bombfarm/desktop": minor
"@bombfarm/team-plan": patch
---

Forge queue: forge the Optimizer's chores in turn, without leaving the tab.

**Add to queue on every forge chore.** Each entry of an Optimizer hero row's forge queue carries
an *Add to queue* button; one press puts the piece and its target on the app's forge queue and the
button reads *Queued*. One entry per piece — a re-run plan that moves a piece's target moves the
queued target rather than adding a second entry.

**The footer runs it.** While the queue holds anything, the status bar shows the queue: how many
pieces wait, the piece rolling and its climb so far (`+9 → +12 · 4 rolls · 12.3k gold`), and Start
or Cancel. Start asks first — the dialog prints the expected gold for everything queued — and is
held back for the same reasons the Forge button is: an account with no server behind it, or the
forge writes switch off. Pieces are forged in order with no per-piece limits, one run at a time
through the same path the Forge tab uses, so the Forge tab's rail draws each queued run as it
rolls. The queue stops on any piece that stops short of its target — out of gold, a server
cooldown, a refused item — and names the reason in the footer; Resume picks up from that piece.
A piece the bag no longer holds, or one already at its target, leaves the queue on its own.

**The Forge tab lists it, and feeds it.** A Forge queue panel beside the bag lists every queued
piece with its climb and lets you take one off, and the plan panel carries the same *Add to
queue* under its Forge button — the piece in hand, at the target the panel shows. The waiting pieces survive a restart — restored paused, never
started on their own.

`@bombfarm/team-plan`: `TeamPlanScreenSlots.forgeQueueAction` — a host-supplied control drawn at
the end of each forge-queue entry. The web supplies none and renders exactly as before.

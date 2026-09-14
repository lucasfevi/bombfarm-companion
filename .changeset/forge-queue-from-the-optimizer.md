---
"@bombfarm/desktop": minor
"@bombfarm/team-plan": patch
"@bombfarm/ui": patch
---

Forge queue: forge the Optimizer's chores in turn, without leaving the tab.

**Add to queue on every forge chore.** Each entry of an Optimizer hero row's forge queue carries
an *Add to queue* button; one press puts the piece and its target on the app's forge queue and the
button reads *Queued*. One entry per piece — a re-run plan that moves a piece's target moves the
queued target rather than adding a second entry.

**A band under the top bar runs it.** While the queue holds anything, a band between the nav and
the screen shows the queue: `0/3 forged`, the piece rolling and its climb so far
(`+9 → +12 · 4 rolls · 12.3k gold`), and Start or Cancel. Start asks first — the dialog prints the
expected gold for everything queued, coin and all — and is
held back for the same reasons the Forge button is: an account with no server behind it, or the
forge writes switch off. Pieces are forged in order with no per-piece limits, one run at a time
through the same path the Forge tab uses, so the Forge tab's rail draws each queued run as it
rolls. The queue stops on any piece that stops short of its target — out of gold, a server
cooldown, a refused item — and names the reason in the band; Resume picks up from that piece.
A piece the bag no longer holds, or one already at its target, leaves the queue on its own.

**The Forge tab lists it, feeds it and runs it.** A Forge queue panel beside the bag lists every
queued piece with its climb, lets you take one off, and carries the same Start and Cancel as the
band; the plan panel carries *Add to queue* under its Forge button — the piece in hand, at the
target the panel shows. The waiting pieces survive a restart — restored paused, never started on
their own.

`@bombfarm/team-plan`: `TeamPlanScreenSlots.forgeQueueAction` — a host-supplied control drawn at
the end of each forge-queue entry. The web supplies none and renders exactly as before.

`@bombfarm/ui`: `AppShell` gains a `banner` slot between the top bar and `<main>` (absent renders
nothing), and `ConfirmDialog`'s close sits in the popup's own corner rather than inside the
padding.

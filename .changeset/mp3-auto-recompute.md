---
"@bombfarm/contracts": minor
"@bombfarm/desktop": minor
---

**The desktop's advice now updates by itself.** When a poll shows a hero's gear, level, stars,
abilities or the skill tree changed, the on-screen advice recomputes and updates within one
refresh cycle — no restart, no re-navigation, no manual refresh button. When nothing
planning-relevant changed, the advice does **not** recompute: a scripted sequence (identical,
relevant change, irrelevant change, identical) asserts the recompute counter moves exactly `1, 2,
2, 2`, the spec's own Independent Test verbatim.

`account:changed` now fires only when the account genuinely changed, not on every poll cycle. A
new pure export, `accountChangeKey(payload: AccountPayload): string` (`@bombfarm/contracts`,
zero new dependencies), is the one canonical, `capturedAt`-blind change key both the main process
(gating the `account:changed` emit) and the renderer (gating which pushed/fetched view is
accepted) compare against. A second, exact key — `heroChangeKey`/`sharedChangeKey`
(`apps/desktop/renderer/lib/planning/hero-advice.ts`) — decides which heroes actually recompute:
a one-hero gear change recomputes that hero only; a shared-tree change recomputes every hero,
correctly.

A section leaving `resolved` (`stale`/`missing`/`degraded`) withdraws its dependent numbers in the
same render as the status change, never one cycle behind; a section returning to `resolved`
recomputes from the new data, never from a pre-degradation cache.

The full 11-hero recompute completes in ~1 ms (measured), asserted against a 16 ms budget — one
60 Hz frame, the threshold below which the recompute cannot delay the Electron main event loop or
drop a renderer frame.

**No behaviour change for the web planner.** `apps/web` is untouched — zero files changed, source
and tests alike. `packages/ui` and `packages/domain` are untouched too: the recompute stays in the
renderer, memoised: only the change *decision* moved to main, and no worker was introduced in
either process.

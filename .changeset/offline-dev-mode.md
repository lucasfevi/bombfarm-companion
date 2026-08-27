---
"@bombfarm/desktop": minor
---

Add `pnpm dev:offline` — the desktop app with no game running and no server reachable.

The account sections come from a committed fixture payload instead of the five REST routes, and
the live tick stream is replayed from a recorded byte capture through the same decoder the real
tap uses, rather than from a hook into the game process. Replay mode never lists processes and
never loads the instrumentation runtime, so a dev build in this mode can run beside a packaged
build tapping the real game.

Both overrides are refused in a packaged build: `isReplayLiveSourceEnabled` takes `isPackaged` as
an argument rather than reading it, so a real install has no path into either whatever its
environment says.

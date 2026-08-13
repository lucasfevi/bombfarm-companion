---
"@bombfarm/desktop": patch
---

Fixed an uncaught main-process exception on shutdown in fixture-mode game reading
(`BFC_GAME_READER=fixture`, test infrastructure only — the real memory-mode reader never writes
to SQLite and was never affected). A tick that reached `AccountStore.commit()` after the account
database had already closed threw `Error: database is not open`; because no code path caught it,
Electron surfaced its default "A JavaScript error occurred in the main process" modal, which
blocks process exit. On an unattended CI runner this held the process open until Playwright's
worker teardown gave up at 120s — the intermittent `smoke-windows` flake seen on roughly a
quarter of `develop` pushes.

Two changes close this off. `GameReaderService.tick()` now wraps the fixture path in the same
try/catch that already recovered a memory-mode tick failure (previously only `tickMemory()` was
guarded, so a fixture-path throw had no recovery path at all), and `stop()` now latches a
`stopped` flag that makes any further tick a no-op immediately — not just reliant on
`clearTimeout` having already run — so a tick can never reach the account store once shutdown has
started. `AccountStore` also gets a defensive closed-guard: `persist()`/`restore()`/`commit()`
after `close()` now report "unavailable" instead of throwing the SQLite driver's raw error, and
`close()` itself is idempotent. `apps/desktop/src/main/index.ts`'s `before-quit` handler already
stopped the game reader before closing storage; that ordering is now documented as load-bearing
rather than incidental.

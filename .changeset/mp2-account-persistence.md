---
"@bombfarm/contracts": minor
"@bombfarm/desktop": minor
---

Add per-section account persistence so the desktop remembers an account across restarts.

`@bombfarm/contracts` gains the stored-account serving contract: `StoredSectionFidelity` (a
narrowed union that structurally cannot represent `resolved`), `StoredAccountFidelity`,
`AccountStoreStatus`, `AccountStoreReason`, `RestoredAccount` (`gameRunning` is the literal
`false`), and `AccountView` — plus a new `account:get` IPC channel returning `AccountView`.

`@bombfarm/desktop`'s `Storage` wrapper gains a real per-section SQLite store
(`apps/desktop/src/main/storage/**`): each of the five account sections (`account`, `heroes`,
`skills`, `casa`, `items`) persists independently with its own `capturedAt`, so a poll that
resolves the roster but misses skills keeps the previous skills row untouched rather than
blanking it. Writes run in one transaction per poll and only ever touch sections a payload
marks `resolved`, so a partial read can never blank stored data. When the desktop starts with
the game closed, the account it shows is read-only, honestly stamped with its capture time, and
`gameRunning` is explicit — no code path can serve a stored section as `resolved`, enforced by
the type (a compile error), the schema (no status column — status is derived from row
presence), and a source guard.

A pre-existing `last-snapshot.json` from an earlier install is imported once, then the file is
never written again; the desktop's previous JSON-file persistence mechanism (`SnapshotStore`)
is removed along with a bug it carried — a cold boot with the game closed no longer reports the
previous session's `connected` status read from disk.

No web planner behaviour changes.

# @bombfarm/desktop

## 0.1.2

### Patch Changes

- dc82f15: `AppShell` grows into a sidebar nav + content area + status bar (data-driven `items`, controlled `activeId`/`onNavigate`; an empty/omitted `items` renders no nav rail). Adds `StatusChip`, the single implementation of the game-connection states (connected / not running / stale, with an optional age label), and `EmptyState` for "no game / no items / no filter matches" placeholders. The sidebar collapses to icons-only below the `compact` breakpoint; collapsed labels stay in the accessibility tree.

  The desktop renderer adopts all three: its hand-rolled `formatStatus`/`statusClass` helpers and hardcoded `emerald`/`amber`/`--bf-*` classes are gone in favor of `StatusChip` and token-based chrome, and the "preload bridge unavailable" / "no snapshot yet" states now render through `EmptyState`.

- Updated dependencies [dc82f15]
- Updated dependencies [dc82f15]
- Updated dependencies [dc82f15]
- Updated dependencies [dc82f15]
  - @bombfarm/ui@0.2.0

## 0.1.1

### Patch Changes

- Updated dependencies [d2116e5]
- Updated dependencies [6ca8b4a]
  - @bombfarm/ui@0.1.0

## 0.1.0

### Minor Changes

- 3f8d4cb: Show the app version in the web footer and desktop shell, and carry version over the typed app-environment IPC boundary. Lands the changesets release rail (release PR, nightly, dormant prod).

### Patch Changes

- b930794: Allow Windows packaging to spawn pnpm.cmd under Node 20+ (shell: true for CVE-2024-27980).
- Updated dependencies [3f8d4cb]
  - @bombfarm/contracts@0.1.0
  - @bombfarm/game-data@0.0.1

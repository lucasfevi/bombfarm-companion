# @bombfarm/ui

## 0.2.0

### Minor Changes

- dc82f15: `AppShell` grows into a sidebar nav + content area + status bar (data-driven `items`, controlled `activeId`/`onNavigate`; an empty/omitted `items` renders no nav rail). Adds `StatusChip`, the single implementation of the game-connection states (connected / not running / stale, with an optional age label), and `EmptyState` for "no game / no items / no filter matches" placeholders. The sidebar collapses to icons-only below the `compact` breakpoint; collapsed labels stay in the accessibility tree.

  The desktop renderer adopts all three: its hand-rolled `formatStatus`/`statusClass` helpers and hardcoded `emerald`/`amber`/`--bf-*` classes are gone in favor of `StatusChip` and token-based chrome, and the "preload bridge unavailable" / "no snapshot yet" states now render through `EmptyState`.

- dc82f15: Adds the toast system DESIGN_SYSTEM.md §11 specifies: a pure, node-testable queue reducer (`toast-queue.ts`) implementing key-based coalescing, a 3-visible/"+N more" overflow stack, severity-dependent auto-dismiss, and threshold-gated progress announcements, plus `ToastProvider`/`useToast`/`ToastViewport`/`ToastItem` built on a plain portal (base-ui's `Toast` couples every rendered toast to its own internal store and timers, which would fight this feature's single-source-of-truth reducer — see `design.md`'s T1 finding). Also adds `NotificationCenter` (a controlled ring-buffer view), `Slider` (a `@base-ui/react/slider` wrap), and the `SettingsSection`/`SettingsRow`/`SaveBar` settings-form primitives.

  The legacy `Toast` stays byte-compatible for `apps/web`'s planner and now carries a `@deprecated` JSDoc pointing at `useToast`. `toast.recipe.ts` is untouched.

### Patch Changes

- dc82f15: Storybook ownership moves from `apps/web` (`@storybook/nextjs`) to `packages/ui`
  (`@storybook/react-vite`) — the catalog now lives with the package it documents.
  Fonts are self-hosted via `@fontsource` instead of `next/font/google`. Adds
  `@storybook/addon-a11y` and a `@storybook/test-runner` gate (`pnpm --filter
@bombfarm/ui test-storybook`) that smoke-renders every story and asserts zero
  accessibility violations, wired into CI on the existing `web` path filter.

  Fixing the a11y violations the new gate found touches a few components' visible
  chrome: `Banner` now renders a `<div role="status">` instead of `<aside
role="status">` (an `<aside>`'s implicit landmark role doesn't permit overriding to
  `status`); the "warn" chip/`StatusChip` tone and `AbilityCard`'s locked-out dimming
  and `Panel`'s unverified dimming are all slightly lighter, raised to clear WCAG AA
  contrast; `FileDropZone`'s inner "Choose file" control is no longer a second
  keyboard tab stop (it was decorative — the drop zone's own `role="button"` wrapper
  already handled activation).

  `apps/web` no longer hosts or depends on Storybook.

- dc82f15: Housekeeping after the Storybook move, no runtime behaviour change. `apps/web`'s
  TypeScript config no longer includes the deleted local `.storybook/` directory, and
  root ESLint now lints `packages/ui` story files (with type checking off, since they
  sit outside the package tsconfig) so the raw `react-icons` / `*.svg` import ban that
  guards the `Icon` seam applies to stories too, not just to product code.

## 0.1.0

### Minor Changes

- d2116e5: Add the `Icon` seam to `@bombfarm/ui`: closed `IconName` union over a UI-chrome registry (`react-icons`), design-system migrations, Storybook gallery, and lint enforcement. Game glyphs are out of scope.

### Patch Changes

- 6ca8b4a: Centralize design tokens in `@bombfarm/ui` (M2): shared `@theme`, typed mirror, WCAG contrast tests, and unified web/desktop palette.

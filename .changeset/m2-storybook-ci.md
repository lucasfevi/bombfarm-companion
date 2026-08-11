---
"@bombfarm/ui": patch
"@bombfarm/web": patch
---

Storybook ownership moves from `apps/web` (`@storybook/nextjs`) to `packages/ui`
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

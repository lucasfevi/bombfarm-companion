# Storybook — design-system catalog

Local Storybook harness owned by `@bombfarm/ui` itself, on `@storybook/react-vite`.
See [`docs/design-system.md`](../../../docs/design-system.md) for variant tables and
the DS-09 reuse boundary.

`packages/ui` used to be consumed-only by `apps/web`'s Storybook (`@storybook/nextjs`);
the catalog now lives with the package it documents (m2-storybook-ci).

## Run

From the monorepo root (or `pnpm --filter @bombfarm/ui …`):

```bash
pnpm --filter @bombfarm/ui storybook          # dev server on :6006
pnpm --filter @bombfarm/ui build-storybook    # static output → storybook-static/ (gitignored)
```

## a11y check

[`@storybook/addon-a11y`](https://storybook.js.org/addons/@storybook/addon-a11y) is
registered in `main.ts` — open any story's **Accessibility** panel in the dev server to
see live violations while you work.

**Zero violations at the default axe severity, always.** Fix the component or the
story; do not allowlist. A per-story rule disable is permitted only with a written
reason in the story file — no global rule-offs.

## Test-runner (CI gate)

`test-runner.ts` runs `injectAxe`/`checkA11y` in `postVisit` for every story, against a
**built, statically served** Storybook (not the dev server) for determinism:

```bash
pnpm --filter @bombfarm/ui build-storybook
pnpm --filter @bombfarm/ui test-storybook     # serves storybook-static/, then runs the suite
```

A story that throws, or fails its a11y check, fails this command with a non-zero exit —
that is what `ci-web.yml`'s `design-system` job (and the `design-system-required`
aggregator, which fails on `skipped`/`cancelled` too, not only `failure`) gates on.

## Adding a primitive story

1. **Colocate** — add `packages/ui/src/<primitive>.stories.tsx` next to the primitive
   (CSF3, `title: 'UI/<Primitive>'`). `.storybook/main.ts` globs
   `./src/**/*.stories.@(ts|tsx)` — package-relative, no absolute path out to
   `apps/web`.
2. **Import boundary** — import only from `@bombfarm/ui` (barrel) or modules inside
   `packages/ui/src`. Never import from `apps/web` features or `@bombfarm/domain` (DS-09
   — a story that needs `@bombfarm/domain` is a boundary violation to report, not to
   alias around).
3. **Dark-only preview** — [`preview.css`](preview.css) imports `../src/styles.css`
   directly (Tailwind v4 + its own `@source` scan of `packages/ui/src` — no separate
   app `globals.css` needed under Vite) and self-hosts DM Sans / IBM Plex Mono via
   `@fontsource` (no Next, no CDN — see `preview.css`'s own comments for why).
   [`decorators.tsx`](decorators.tsx) wraps the canvas in `bg-bg text-ink font-sans`.
   Do not add light-mode stories or a theme toggle. If a story looks like a bare
   browser control, rebuild (`build-storybook`) and confirm the Vite Tailwind plugin
   is processing `preview.css`.
4. **Viewports** — default canvas is **1280×800**; optional **1024×768** and
   **768×1024** presets. No phone-first matrix.
5. **Variants** — cover every cva variant / representative state from
   `docs/design-system.md` (see existing `*.stories.tsx` for patterns).
6. **a11y** — every story renders through the test-runner in CI. Design for it: label
   form controls (wrap in `<label>`, matching real call sites), don't nest interactive
   elements, keep contrast at 4.5:1+ for normal text.

Verify with `pnpm --filter @bombfarm/ui build-storybook` and
`pnpm --filter @bombfarm/ui test-storybook` before opening a PR.

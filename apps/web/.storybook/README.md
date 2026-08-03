# Storybook — design-system catalog

Local Storybook harness hosted by `@bombfarm/web` for `@bombfarm/ui` primitives.
See [`docs/design-system.md`](../../../docs/design-system.md) for variant tables and the DS-09 reuse boundary.

## Run

From the monorepo root (or `pnpm --filter @bombfarm/web …`):

```bash
pnpm --filter @bombfarm/web storybook          # dev server on :6006
pnpm --filter @bombfarm/web build-storybook    # static output → storybook-static/
```

## Adding a primitive story

1. **Colocate** — add `packages/ui/src/<primitive>.stories.tsx` next to the primitive (CSF3, `title: 'UI/<Primitive>'`). `.storybook/main.ts` globs that tree.
2. **Import boundary** — import only from `@bombfarm/ui` (barrel) or modules inside `packages/ui/src`. Never import from `apps/web` features or `@bombfarm/domain`.
3. **Dark-only preview** — [`preview.css`](preview.css) imports web `globals.css` (Tailwind v4 + `@source` for `packages/ui/src`). Decorators apply DM Sans / IBM Plex Mono on `<html>` and wrap the canvas in `bg-bg text-ink font-sans`. Do not add light-mode stories or a theme toggle. If a story looks like a bare browser control, restart Storybook and confirm PostCSS/`@tailwindcss/postcss` is processing `preview.css`.
4. **Viewports** — default canvas is **1280×800**; optional **1024×768** and **768×1024** presets. No phone-first matrix.
5. **Variants** — cover every cva variant / representative state from `docs/design-system.md` (see existing `*.stories.tsx` for patterns).

Verify with `pnpm --filter @bombfarm/web build-storybook` before opening a PR.

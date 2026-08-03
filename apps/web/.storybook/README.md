# Storybook — design-system catalog

Local Storybook harness for `src/shared/design-system` primitives. See [`docs/design-system.md`](../docs/design-system.md) for variant tables and the DS-09 reuse boundary.

## Run

```bash
pnpm storybook          # dev server on :6006
pnpm build-storybook    # static output → storybook-static/
```

## Adding a primitive story

1. **Colocate** — add `src/shared/design-system/<primitive>.stories.tsx` next to the primitive (CSF3, `title: 'UI/<Primitive>'`).
2. **Import boundary** — import only from `@/shared/design-system` (barrel) or modules inside `design-system/`. Never import from `features/` or `shared/domain`.
3. **Dark-only preview** — [`.storybook/preview.css`](preview.css) imports `globals.css` (Tailwind v4 + `@source` for `design-system/`). Decorators apply DM Sans / IBM Plex Mono on `<html>` and wrap the canvas in `bg-bg text-ink font-sans`. Do not add light-mode stories or a theme toggle. If a story looks like a bare browser control, restart Storybook and confirm PostCSS/`@tailwindcss/postcss` is processing `preview.css`.
4. **Viewports** — default canvas is **1280×800**; optional **1024×768** and **768×1024** presets. No phone-first matrix.
5. **Variants** — cover every cva variant / representative state from `docs/design-system.md` (see existing `*.stories.tsx` for patterns).

Verify with `pnpm build-storybook` before opening a PR.

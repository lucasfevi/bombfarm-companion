# Tailwind-first styling

**Status:** hard truth  
**Cursor stub:** [`.cursor/rules/tailwind-first.mdc`](../.cursor/rules/tailwind-first.mdc)

Policy: named layout/widget/overlay CSS migrates into **Tailwind v4 utilities + `@theme` tokens**. `globals.css` may contain only `@theme` / base element styles + **documented irreducible exceptions**.

## Rules

1. Prefer Tailwind v4 utilities for layout, spacing, typography, and color (theme tokens).
2. Design tokens live in `@theme` (`--color-*`, `--font-*`, …). Use theme utilities — no hardcoded palette except documented brand exceptions (Ko-fi coffee hex). Existing named CSS may keep `var(--bg)` via `:root` aliases until deleted.
3. Prefer `@base-ui/react` + utilities for simple, single-state elements. Use `cva` for **multi-variant primitives** in `packages/ui/src/*` (typed `variants` + `defaultVariants`); compose final class strings through a `cn()` helper backed by `tailwind-merge`. Do not scatter cva calls across leaf feature components — keep variant definitions in the primitive. See [`design-system.md`](design-system.md).
4. **Migrate** when the class is mostly flex/grid/gap/padding/typography/simple hover-focus-disabled. **Keep (temporary or permanent)** when it needs complex `::before`/`::after`, scrollbar pseudos, multi-layer `color-mix` walls, or keyframes not yet in `@theme`.
5. **Collision gate (hard):** Until the named CSS is renamed or removed, do **not** adopt Tailwind utilities that collide with live short class names (historically `.col`, `.fill`, …). Audit before adopting.
6. Delete CSS only after grep shows zero references.
7. No new large named layout classes. New UI = utilities by default.
8. **Permanent keeps only:** see [`css-exceptions.md`](css-exceptions.md) (4 permanent groups; no temporary table families). Do not add new named widget CSS.
9. **Cascade gate (hard):** After `@import 'tailwindcss'`, do **not** redeclare form `font` / `color` inherit (or similar resets) as unlayered CSS on `button` / `input` / `select`. Preflight already does that inside `@layer base`. Unlayered rules beat `@layer utilities`, so they silently override `text-*` / `text-muted` / etc. and inflate controls to inherited body size. Put any intentional base tweak in `@layer base`, or omit it.
10. **No conflicting utility append (mitigated by `cn()`):** The "stylesheet order wins, not class-string order" foot-gun is mitigated by `tailwind-merge` — `cn()` resolves conflicting utilities by last-wins at merge time (`cn('bg-bg-2','bg-accent') === 'bg-accent'`), so a caller `className` can safely override a primitive's base. Hand-built shared-string concatenation for variants (e.g. `${btnClass} bg-accent`) is **deprecated** in favor of `cva` + `cn()`; keep each variant's `border-*` / `bg-*` / `text-*` in its cva recipe.

```tsx
// ❌ BAD — new one-off layout class
<div className="my-flex-row">…

// ✅ GOOD — utilities + theme tokens
<div className="flex flex-wrap items-center gap-2">…
```

```css
/* ❌ BAD — unlayered; overrides text-* on controls */
button, input, select {
  font: inherit;
  color: inherit;
}

/* ✅ GOOD — Preflight already covers this in @layer base; leave it alone.
   If you must extend base: */
@layer base {
  /* intentional base-only tweaks */
}
```

## Related

- Exception catalog (living): [`css-exceptions.md`](css-exceptions.md)
- Feature inventory / collision audit history: `.specs/features/tailwind-migration/`

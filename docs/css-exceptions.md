# CSS exceptions

**Status:** hard truth  
**Related:** [`tailwind-first.md`](tailwind-first.md)  
**Sources:** AD-003; feature `tailwind-migration`; post-finalize `tailwind-finalize`

`globals.css` may contain only `@theme` / base element styles + the exceptions below. Do not add new named widget/layout CSS.

`apps/web/src/app/globals.css` is **30** lines (`wc -l` / `(Get-Content src\app\globals.css).Count`) after the shared-chrome promotion: the base element styles, checkbox chrome, scrollbar chrome, and the `.btn.coffee` exception moved into `packages/ui/src/styles.css` (**300** lines) so both `apps/web` and `apps/desktop` inherit them from one place instead of `apps/web` carrying them alone. `apps/web/src/app/globals.css` now keeps only the `@import`, its local `@source` lines, and the `.roster-summary` / `.roster[open]` chevron group. Re-verify with a line count when changing exceptions.

## Base element styling (not an exception)

Bare-element rules for `html` / `:root` / `*` / `body` and for `table` / `th` / `td` / `tr:last-child td` live in `packages/ui/src/styles.css` — the table family inside `@layer base`. They are **allowed base element styles**, **not** a named keep-exception group (TW-07 / AD-003). Sheet/pts/compact tables rely on the table rules for `border-collapse`, tabular nums, `th` uppercase, and cell padding/borders. Do not promote them into the permanent-exception table, and do not wrap every simple table in a primitive just to avoid these rules.

## Permanent keep-exceptions

| Exception | Lives in | Reason |
| --- | --- | --- |
| `*::-webkit-scrollbar*` (+ `scrollbar-*`) | `packages/ui/src/styles.css` | Pseudo scrollbar styling not expressible cleanly in utilities |
| `input[type=checkbox]` (+ `::after` masks) | `packages/ui/src/styles.css` | Appearance/mask-image checkbox chrome |
| `.roster-summary::before` (+ open rotate) | `apps/web/src/app/globals.css` | Details chevron pseudo (roster expander; `.explain-summary::before` retired — `ExplainSection` migrated to the `Collapsible` primitive's `react-icons` chevron, `ui-accordion`) |
| `.btn.coffee` / `.btn.coffee.full` | `packages/ui/src/styles.css` | Ko-fi brand hex `#ffdd00` / `#e5c700` (AD-003); co-located with `button.recipe.ts`'s `coffee` / `coffee-full` variants, the recipe that emits the class string |

**Group count:** **4** permanent exception groups — 3 shared (`packages/ui/src/styles.css`), 1 web-only (`apps/web/src/app/globals.css`). No temporary table families remain.

## Cleared (do not resurrect as named CSS)

Chrome layout, buttons, chips/rank-ctl, slots, abilities, track/fill bars, dialog/overlay/toast shell (`animate-toast-in` in `@theme`), roster / import-table / sheet / pts / compact / `hl` / `delta-mismatch` / `td.warn` dense-table families (`tailwind-finalize`).

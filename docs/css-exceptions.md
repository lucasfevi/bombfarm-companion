# CSS exceptions

**Status:** hard truth  
**Related:** [`tailwind-first.md`](tailwind-first.md)  
**Sources:** AD-003; feature `tailwind-migration`; post-finalize `tailwind-finalize`

`globals.css` may contain only `@theme` / base element styles + the exceptions below. Do not add new named widget/layout CSS.

`src/app/globals.css` is **267** lines (`wc -l` / `(Get-Content src\app\globals.css).Count`) after `tailwind-finalize` + the `.explain-summary::before` retirement (`ui-accordion`) (down from ~1949 pre-migration). Re-verify with a line count when changing exceptions.

## Base element styling (not an exception)

Bare-element rules for `table` / `th` / `td` / `tr:last-child td` live in `@layer base` inside `globals.css`. They are **allowed base element styles** (same category as `*` / `body`), **not** a named keep-exception group (TW-07 / AD-003). Sheet/pts/compact tables rely on them for `border-collapse`, tabular nums, `th` uppercase, and cell padding/borders. Do not promote them into the permanent-exception table, and do not wrap every simple table in a primitive just to avoid these rules.

## Permanent keep-exceptions

| Exception | Reason |
| --- | --- |
| `*::-webkit-scrollbar*` (+ `scrollbar-*`) | Pseudo scrollbar styling not expressible cleanly in utilities |
| `input[type=checkbox]` (+ `::after` masks) | Appearance/mask-image checkbox chrome |
| `.roster-summary::before` (+ open rotate) | Details chevron pseudo (roster expander; `.explain-summary::before` retired — `ExplainSection` migrated to the `Collapsible` primitive's `react-icons` chevron, `ui-accordion`) |
| `.btn.coffee` / `.btn.coffee.full` | Ko-fi brand hex `#ffdd00` / `#e5c700` (AD-003) |

**Group count:** **3** permanent exception groups. No temporary table families remain.

## Cleared (do not resurrect as named CSS)

Chrome layout, buttons, chips/rank-ctl, slots, abilities, track/fill bars, dialog/overlay/toast shell (`animate-toast-in` in `@theme`), roster / import-table / sheet / pts / compact / `hl` / `delta-mismatch` / `td.warn` dense-table families (`tailwind-finalize`).

# Hard truths — Bomb Farm Companion (shared)

Durable rules for **desktop**, **web**, and shared packages. Web-only rules live under [`apps/web/docs/`](../apps/web/docs/README.md).

These are **current truth**. Do not invent planning/spec paths in this repo.

| Doc | Topic |
| --- | --- |
| [tailwind-first.md](tailwind-first.md) | Styling: Tailwind utilities + `@theme` |
| [design-system.md](design-system.md) | UI primitives (cva + `cn()`), tokens, reuse boundary |
| [base-ui-first.md](base-ui-first.md) | Prefer `@base-ui/react` before inventing controls |
| [animation.md](animation.md) | Animating Base UI disclosures — Motion technique |
| [content-fit-ui.md](content-fit-ui.md) | Size controls from real content; no accidental truncation |
| [no-layout-shift.md](no-layout-shift.md) | No CLS from toggling required/status chrome |
| [css-exceptions.md](css-exceptions.md) | Allowed named CSS leftovers |
| [react-performance.md](react-performance.md) | React performance boundaries |
| [naming.md](naming.md) | Filenames, identifier conventions, no terse names |
| [i18n.md](i18n.md) | Lang policy, game-labels |
| [validation.md](validation.md) | Author ≠ validator |
| [git-commits.md](git-commits.md) | Atomic commits by default; commitlint |
| [hard-truths.md](hard-truths.md) | How to propose / accept new hard truths |

## Web-only

See [`apps/web/docs/README.md`](../apps/web/docs/README.md) for architecture, state, localStorage, e2e, and planner-specific rules.

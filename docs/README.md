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
| [use-the-width.md](use-the-width.md) | Side-by-side over stacked short rows; agents report wasted width |
| [css-exceptions.md](css-exceptions.md) | Allowed named CSS leftovers |
| [react-performance.md](react-performance.md) | React performance boundaries |
| [naming.md](naming.md) | Filenames, identifier conventions, no terse names |
| [comments.md](comments.md) | Write almost no comments; code and tests are the documentation |
| [i18n.md](i18n.md) | Lang policy, game-labels, plain-language player copy |
| [validation.md](validation.md) | Author ≠ validator |
| [git-commits.md](git-commits.md) | Atomic commits by default; commitlint |
| [line-endings.md](line-endings.md) | LF everywhere; no in-place stream edits |
| [machine-load.md](machine-load.md) | One CPU budget divided among concurrent runs; the per-tool ceilings and the `BFC_CPU_BUDGET` knob |
| [branching.md](branching.md) | `develop` integration, `main` release-only |
| [releases.md](releases.md) | Changesets release rail, artifacts, recovery |
| [hard-truths.md](hard-truths.md) | How to propose / accept new hard truths |
| [typescript-planner-origin.md](typescript-planner-origin.md) | Documented TS/ESLint exception for `@bombfarm/domain` + `@bombfarm/ui` |
| [fidelity-gate.md](fidelity-gate.md) | The MP2 fidelity gate: live-vs-export sheet-math parity, the capture pair, the outstanding handoff |
| [fixture-corpus.md](fixture-corpus.md) | MP5 F1: the post-2026-08-13-patch fixture corpus — provenance, what the deletion cost, the round-trip invariant, and the keystone handoff count |
| [wiki-drift-check.md](wiki-drift-check.md) | MP5 F5: the scheduled wiki drift detector — the narrowed no-wiki-client rule, the four outcomes, accepting a drift, and the recurring cost |
| [market-prices.md](market-prices.md) | The continuously produced Steam Community Market snapshot: facet-driven discovery, catalog reconciliation, what the published JSON says, and why the price is a floor |
| [wire-vocabulary.md](wire-vocabulary.md) | Generated — the wire-to-domain vocabulary tables for the `/rotation` route and the live combat frame; regenerate with `pnpm generate:wire-vocabulary` |
| [live-logging.md](live-logging.md) | The shared log's dedup/redaction guarantees, the frame ring, and the dev-gated replay-fixture capture |
| [offline-dev-mode.md](offline-dev-mode.md) | `pnpm dev:offline` — the desktop app with no game and no server: fixture account, replayed live capture, and why it is not a mock server |

## Web-only

See [`apps/web/docs/README.md`](../apps/web/docs/README.md) for architecture, state, localStorage, e2e, and planner-specific rules.

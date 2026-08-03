# Hard truths — `@bombfarm/web` only

Planner/web-specific durable rules. Shared monorepo rules live at the companion root [`docs/`](../../../docs/README.md).

| Doc | Topic |
| --- | --- |
| [architecture.md](architecture.md) | Composer / panels / lib ownership |
| [state-management.md](state-management.md) | Zustand store: slices, selectors, no `zustand/persist` |
| [local-data-compat.md](local-data-compat.md) | Public localStorage: additive + normalize |
| [import-only-heroes.md](import-only-heroes.md) | Import-only roster — required `sourceId` |
| [explain-math.md](explain-math.md) | Keep How-the-math-works synced with lib math |
| [level-stars-sheet.md](level-stars-sheet.md) | Level/stars naked+geared sync |
| [e2e-visual.md](e2e-visual.md) | Playwright e2e + visual baselines |
| [adr/013-app-shell-route-group.md](adr/013-app-shell-route-group.md) | Shared `(app)` shell + `@planner` keep-alive |

## Shared (root)

Prefer linking up: [`docs/design-system.md`](../../../docs/design-system.md), [`docs/validation.md`](../../../docs/validation.md), [`docs/i18n.md`](../../../docs/i18n.md), and the rest of the root index.

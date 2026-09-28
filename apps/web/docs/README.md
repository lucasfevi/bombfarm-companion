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
| [e2e.md](e2e.md) | Playwright smoke e2e — Docker vs host runs, CI layout, the `e2e-smoke` gate |
| [adr/013-app-shell-route-group.md](adr/013-app-shell-route-group.md) | Shared `(app)` shell + `@planner` keep-alive |
| [adr/015-cdn-cache-headers.md](adr/015-cdn-cache-headers.md) | `vercel.json` cache windows, and why the art is 30 days and the prefetch payloads 5 minutes |
| [adr/016-one-cadence-model.md](adr/016-one-cadence-model.md) | One measured bomb-cycle model behind every DPS figure; the advisor's serial model is retired (superseded by 018) |
| [adr/017-clear-time-standing-props.md](adr/017-clear-time-standing-props.md) | Clear time is an integral over the props still standing, crits rolled per hit |
| [adr/018-one-plant-cycle.md](adr/018-one-plant-cycle.md) | One plant cycle, measured per plant on two accounts, behind both the clear and the per-hero bombs/s |

## Shared (root)

Prefer linking up: [`docs/design-system.md`](../../../docs/design-system.md), [`docs/validation.md`](../../../docs/validation.md), [`docs/i18n.md`](../../../docs/i18n.md), and the rest of the root index.

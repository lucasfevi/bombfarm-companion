# TypeScript — planner-origin packages

**Status:** permanent exception (MP1 HYG-DEBT-01)

`tsconfig.base.json` enables `strict`, `exactOptionalPropertyTypes`, and
`noUncheckedIndexedAccess` for companion-native packages.

`@bombfarm/domain` and `@bombfarm/ui` were absorbed from the hero planner with
those two flags **off** in their package `tsconfig.json`, and root ESLint uses
`recommendedTypeChecked` (not `strictTypeChecked`) for those package globs.
Companion-native packages (`contracts`, `game-data`, `pricing`, desktop) keep
the stricter bar.

**Do not silently flip domain/ui to full base strict** without a dedicated
cleanup PR — the surface area is large and unrelated to packaging. Restoring
strictness is allowed later as its own chore; until then this exception is
intentional and documented.

## Scope unchanged by `AD-032`/`AD-033` (MP3 F1)

MP3 F1 makes `@bombfarm/domain` a **built** package — consumers (`apps/desktop`'s main
process and renderer) resolve its `dist/**/*.d.ts` under `skipLibCheck`, rather than its
`src/**/*.ts` under this package's own relaxed `tsconfig.json`. That is precisely what lets
this exception stay **unchanged in scope**: the two packages (`@bombfarm/domain`,
`@bombfarm/ui`) and the ESLint globs above are identical before and after — no new package or
config is covered, and none is removed. A consumer built against `dist` never compiles
domain's source under its own strictness bar at all, so the packaging change is orthogonal to
this exception rather than an extension of it.

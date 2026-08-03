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

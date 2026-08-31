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

## `@bombfarm/ui` and `@bombfarm/game-art` still ship source, so a strict consumer checks them

The exception governs each package's **own** `tsconfig.json`. It does not follow the code into a
consumer: `@bombfarm/ui` and `@bombfarm/game-art` export `./src/*` from their `exports` maps, so
anything importing them compiles their **source**, under the importer's flags rather than their
own. `skipLibCheck` cannot help — it skips `.d.ts`, and these are `.ts`.

That is why bringing the desktop renderer up to the base tier meant fixing errors in both
packages, not only in `apps/desktop/renderer`. Their own `tsconfig.json` files are unchanged and
still relax the two flags, but their sources are now clean at the base bar and
`apps/desktop`'s typecheck is what holds them there. A new violation in either package will pass
that package's own `typecheck` and fail the desktop's — check the desktop before assuming a green
package means a green repo.

`@bombfarm/domain` is not in this position: it resolves through `dist/**/*.d.ts` (see below), so a
consumer never compiles its source at all.

## Scope unchanged by `AD-032`/`AD-033` (MP3 F1)

MP3 F1 makes `@bombfarm/domain` a **built** package — consumers (`apps/desktop`'s main
process and renderer) resolve its `dist/**/*.d.ts` under `skipLibCheck`, rather than its
`src/**/*.ts` under this package's own relaxed `tsconfig.json`. That is precisely what lets
this exception stay **unchanged in scope**: the two packages (`@bombfarm/domain`,
`@bombfarm/ui`) and the ESLint globs above are identical before and after — no new package or
config is covered, and none is removed. A consumer built against `dist` never compiles
domain's source under its own strictness bar at all, so the packaging change is orthogonal to
this exception rather than an extension of it.

---
"@bombfarm/domain": minor
"@bombfarm/desktop": minor
---

`@bombfarm/domain` is now consumed as a **built package** (`dist/` + `.d.ts`), the same way
`@bombfarm/contracts`, `@bombfarm/game-api`, `@bombfarm/game-data` and `@bombfarm/pricing`
already are, instead of advertising its TypeScript source through `exports`. This is a
packaging contract change, not a math change: not one byte of `packages/domain/src` — the
sheet math MP2's fidelity gate protects to a worst error of `1.1e-11` — was touched. The
package's `exports` map now targets `dist/**` (four directory subpaths — `./gear`, `./model`,
`./stat-breakdown`, `./team-plan` — plus a `./data/*` JSON target and a file/nested-file
wildcard), and a new packaging test proves every in-use `@bombfarm/domain[/subpath]` specifier
in the repo resolves through Node's own module resolver, not just by reading the map.

**The desktop can now compute with the planner engine.** `@bombfarm/desktop` declares
`@bombfarm/domain` as a real `workspace:*` dependency (it previously resolved only by
accident, via pnpm's root-level hoisting) and imports it from both processes: the main process
computes a value through the built package under its own strict TypeScript bar
(`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`), and the renderer renders one
domain-derived label. Neither import adds any planning UI, recompute, or i18n wiring — that is
later MP3 work (F2/F3/F4). This feature only proves the edge compiles, bundles (esbuild inlines
the domain code; the desktop's own long-running team-plan solver is confirmed absent from the
bundle), and reaches the DOM.

**No behaviour change for the web planner.** `apps/web` keeps resolving `@bombfarm/domain`
through its existing tsconfig `paths` and bundler aliases — it never reads the new `exports`
map — and zero files under `apps/web` changed in this release. A guard test now pins those
resolution entries so a future cleanup cannot silently move the public planner onto `dist`,
which Vercel's production build never produces.

`docs/typescript-planner-origin.md`'s documented strictness exception for `@bombfarm/domain`
and `@bombfarm/ui` is unchanged in scope — the same two packages, the same ESLint globs. A
consumer built against `dist` never compiles domain's source under its own relaxed bar at all,
so this packaging change is orthogonal to that exception rather than an extension of it.

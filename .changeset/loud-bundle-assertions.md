---
"@bombfarm/web": patch
---

Make the build-output bundle assertions actually run in CI.

`ci-web.yml` ran the web unit tests before `pnpm --filter @bombfarm/web build`, so `apps/web/out`
never existed while the suite ran. Both tests that assert on real build output —
`team-plan-worker-bundle` (the team-plan worker chunk actually ships) and
`devtools-not-in-production-bundle` (zustand devtools does not) — guarded themselves with a silent
`return`, took that branch on every CI run, and reported green without verifying anything.

The build step now runs before the web unit tests, and the skip branch is local-only: under `CI` a
missing build throws with a message pointing at the workflow ordering. Domain tests still run ahead
of the build to keep fast feedback. Also removed a tautological test in `team-plan-worker-bundle`
that asserted `existsSync(out)` in both of its branches and so could never fail.

/**
 * design §5.7 (missing artifact is a hard CI=1 failure, never an early-out; both directions
 * recorded in validation.md) — the shared "green without executing" guard, lifted
 * from `apps/web/src/tests/support/build-output.ts`'s `requireBuildOutput` into a
 * fixture-agnostic form so every artifact-dependent suite in this feature routes through the
 * same shape: F4 has FOUR guarded artifacts (the two API bodies, the export corpus, the
 * rejection fixture directory), and duplicating this five times would be its own drift risk.
 *
 * The trap this closes (this repo's repeated "green without executing" failure — AGENTS.md /
 * tasks.md's own accounting): a bare `if (!existsSync(path)) return` reports GREEN when the
 * guarded artifact is missing, so the suite passes without ever running the assertion it exists
 * to make.
 *
 * So: skipping is a local-developer convenience only. Under `CI`, a missing artifact is a hard
 * failure — it means a fixture was deleted, renamed, or never committed, and that must be loud.
 */
import { existsSync } from 'node:fs';

/** GitHub Actions sets `CI=true`; be liberal about what other runners set. */
function isCi(): boolean {
  const raw = process.env.CI;
  if (raw === undefined || raw === '') return false;
  const normalized = raw.toLowerCase();
  return normalized !== '0' && normalized !== 'false';
}

/**
 * Returns `true` when `path` exists and the caller should assert against it.
 *
 * Returns `false` (with a visible console note) only outside CI. Inside CI it throws, failing
 * the test, because a missing artifact means the guard it feeds can no longer prove anything.
 */
export function requireFixture(path: string, assertion: string): boolean {
  if (existsSync(path)) return true;

  if (isCi()) {
    throw new Error(
      `[require-fixture] ${path} is missing in CI, so "${assertion}" cannot run. ` +
        'This guard intentionally does not skip when its artifact is absent — restore the ' +
        'fixture, or the guard is passing without ever having executed.',
    );
  }

  console.info(
    `[require-fixture] ${path} absent — skipping "${assertion}". Restore the fixture to ` +
      'exercise it locally. (This skip is local-only; in CI a missing fixture fails the test.)',
  );
  return false;
}

import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { ConsentRecord, GrantedConsent } from './consent.js';
import { CONSENT_TEXT } from './consent-text.js';

export type FixtureName = 'api-bodies.json' | 'api-bodies-after.json';

/**
 * Resolves a committed `src/__fixtures__/*.json` fixture to an absolute filesystem path — never
 * `import`ed, so nothing under `src/__fixtures__/**` lands in `dist` (T5 Done-when). Exposed
 * separately from {@link loadFixtureJson} so callers (T5's `fingerprints.test.ts`/`shape.test.ts`)
 * can run it through {@link requireFixture} BEFORE reading it (`MSG-09`).
 */
export function fixturePath(name: FixtureName): string {
  return fileURLToPath(new URL(`./__fixtures__/${name}`, import.meta.url));
}

/** Reads a committed fixture with `node:fs`. Test-support only; not exported from `index.ts`. */
export function loadFixtureJson(name: FixtureName): Record<string, Record<string, unknown>> {
  return JSON.parse(readFileSync(fixturePath(name), 'utf8')) as Record<string, Record<string, unknown>>;
}

/**
 * MP5 F4 (T5) — package-local copy of `packages/domain/tests/helpers/require-fixture.ts`'s
 * `requireBuildOutput` shape (design §5.7). NOT re-pointed at the shared domain helper: unlike
 * `apps/desktop`'s renderer tsconfig (no `rootDir`), `packages/game-api/tsconfig.json` sets
 * `"rootDir": "src"` and has no test-file exclusion, so `tsc -p tsconfig.json` fails with
 * TS6059 the moment ANY source file — including a `.test.ts` — imports something outside
 * `packages/game-api/src`, cross-package relative path or not. Duplicated here, not re-pointed;
 * behaviourally identical to the domain original.
 */
function isCi(): boolean {
  const raw = process.env.CI;
  if (raw === undefined || raw === '') return false;
  const normalized = raw.toLowerCase();
  return normalized !== '0' && normalized !== 'false';
}

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

/** `noUncheckedIndexedAccess` helper for tests: unwraps a possibly-`undefined` lookup with a
 *  descriptive failure instead of a bare non-null assertion (banned by lint in this package). */
export function required<T>(value: T | undefined, message: string): T {
  if (value === undefined) {
    throw new Error(message);
  }
  return value;
}

/** A consent record of any decision, stamped with the current `CONSENT_TEXT.version` unless the
 *  caller overrides it (e.g. `CONSENT_TEXT.version - 1` for a stale-grant case). Test-support
 *  only; not exported from `index.ts`. */
export function consentRecord(
  overrides: Partial<ConsentRecord> & Pick<ConsentRecord, 'decision'>,
): ConsentRecord {
  return { textVersion: CONSENT_TEXT.version, ...overrides };
}

/** A granted consent record — `grantedAt` is required, as {@link GrantedConsent} narrows it to be.
 *  `textVersion` defaults to `CONSENT_TEXT.version`; override it for a stale or future grant. */
export function grantedConsent(
  grantedAt: string,
  overrides: Partial<Omit<GrantedConsent, 'decision' | 'grantedAt'>> = {},
): GrantedConsent {
  return { decision: 'granted', grantedAt, textVersion: CONSENT_TEXT.version, ...overrides };
}

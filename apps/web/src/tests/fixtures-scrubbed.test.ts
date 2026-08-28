// Privacy guard for the web planner's own committed fixtures — the mirror of
// `packages/domain/tests/fixtures-scrubbed.test.ts`. `apps/web/src/tests/fixtures/sheet-math`
// no longer commits its own captures (domain is the sole copy, enforced by
// `tools/fixture-corpus-parity.test.mjs`'s MFR-06 check); this guard's remaining subjects are
// whatever other fixture JSON the web tree commits on its own.
//
// The field list is duplicated rather than imported: `@bombfarm/domain`'s test helpers are not
// part of its published surface, and this package must not reach into another package's
// `tests/` directory. `packages/domain/tests/helpers/fidelity-pair.ts` is the source of truth —
// keep the two in step if the list ever grows.
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(here, 'fixtures');

const PERSONAL_FIELDS = ['account_id', 'player_name'] as const;

function listJsonFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listJsonFiles(full));
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      files.push(full);
    }
  }
  return files;
}

describe('committed web fixtures carry no player identity', () => {
  it('no fixture JSON under apps/web/src/tests/fixtures mentions a personal field', () => {
    const files = listJsonFiles(FIXTURES_DIR);
    // Guards the guard: a bad path would make this pass vacuously.
    expect(files.length, `no fixture JSON found under ${FIXTURES_DIR}`).toBeGreaterThan(0);

    const offenders: string[] = [];
    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      for (const field of PERSONAL_FIELDS) {
        if (content.includes(field)) {
          offenders.push(`${relative(FIXTURES_DIR, file)} (${field})`);
        }
      }
    }

    const message =
      offenders.length > 0
        ? `Committed fixtures still carry personal fields: ${offenders.join(', ')}. Remove the ` +
          `account.${PERSONAL_FIELDS.join(' / account.')} keys entirely before committing a capture ` +
          `— see docs/fidelity-gate.md.`
        : 'no offenders';
    expect(offenders, message).toEqual([]);
  });
});

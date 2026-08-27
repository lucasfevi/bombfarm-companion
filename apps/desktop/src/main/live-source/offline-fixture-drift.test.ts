import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/** `__dirname`, not `import.meta.url`: `tsconfig.main.json` builds this tree to CommonJS. */
const HERE = __dirname;
const COMMITTED = resolve(HERE, '..', '..', '..', 'tests', 'fixtures', 'account-offline.json');
const GENERATOR = resolve(HERE, '..', '..', '..', 'scripts', 'generate-offline-fixture.mjs');

/**
 * The counterpart to `fixtures/replay-stream-drift.test.ts`, which pins `replay-stream.bin` to its
 * generator the same way. Without it a hand-edit of the committed JSON, or a generator change made
 * without regenerating, goes unnoticed — and the file is 7,000+ lines, so nobody reads the diff.
 */
describe('the offline account fixture matches its generator', () => {
  it('is byte-identical to what the generator produces from the same two captures', async () => {
    const { serializeOfflineFixture } = (await import(GENERATOR)) as {
      serializeOfflineFixture: () => string;
    };

    // `readFileSync` as utf8, not a Buffer compare: the repo is LF everywhere and the generator
    // writes LF, so a byte compare would fail on a checkout that normalised endings rather than on
    // real content drift.
    expect(serializeOfflineFixture()).toBe(readFileSync(COMMITTED, 'utf8'));
  });

  it('still agrees with itself about who is on the field', async () => {
    const { buildOfflineFixture } = (await import(GENERATOR)) as {
      buildOfflineFixture: () => { casa: { field_size: number; heroes: { in_field: boolean }[] } };
    };
    const payload = buildOfflineFixture();

    // The generator throws when these disagree; this proves the check is reached and satisfied
    // rather than trusting that it would have fired.
    expect(payload.casa.heroes.filter((hero) => hero.in_field).length).toBe(payload.casa.field_size);
  });
});

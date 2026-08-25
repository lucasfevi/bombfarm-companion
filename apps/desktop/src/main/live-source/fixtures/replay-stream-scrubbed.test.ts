import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readCaptureRecords } from '../capture-format.js';
import { PERSONAL_FIELDS } from '../frame-ring.js';

/** `__dirname`, not `import.meta.url`: `tsconfig.main.json` builds this tree to CommonJS. */
const HERE = __dirname;

const FIXTURES = ['replay-stream.bin', 'live-capture.bfcc'] as const;

describe.each(FIXTURES)('%s carries no player identity', (fixture) => {
  const committedPath = resolve(HERE, fixture);

  it('is not empty or missing, so the field-name check below cannot pass vacuously', () => {
    const bytes = readFileSync(committedPath);
    expect(bytes.length).toBeGreaterThan(0);
  });

  it('mentions neither account_id nor player_name anywhere in the committed bytes', () => {
    const text = readFileSync(committedPath).toString('latin1');

    const offenders = PERSONAL_FIELDS.filter((field) => text.includes(field));
    expect(
      offenders,
      `${fixture} contains the personal field(s): ${offenders.join(', ')}. Regenerate the fixture ` +
        `from a capture with those keys stripped before committing.`,
    ).toEqual([]);
  });
});

/**
 * `live-capture.bfcc` is a trimmed real session, kept to the single combat-websocket connection
 * (docs/live-logging.md §5) — REST response bodies are the one place `account_id`/`player_name`
 * appear in a capture, so a capture with no REST connection at all carries no account identifiers
 * by construction, not just by the two field names above happening not to match. This does not
 * apply to `replay-stream.bin`: that synthetic fixture deliberately carries an HTTP response as
 * part of its own decoder-resync coverage.
 */
describe('live-capture.bfcc structurally carries no REST connection to leak an identifier from', () => {
  const records = [...readCaptureRecords(readFileSync(resolve(HERE, 'live-capture.bfcc')))];

  it('is on a single connection id, so there is no second, REST connection captured alongside it', () => {
    expect(new Set(records.map((record) => record.ctx)).size).toBe(1);
  });

  it('contains no HTTP response bytes anywhere in any record', () => {
    const offenders = records.filter((record) => Buffer.from(record.bytes).toString('latin1').includes('HTTP/1.'));
    expect(offenders).toEqual([]);
  });
});

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isSensitiveKey } from '../../boundary-log/redaction.js';
import { readCaptureRecords } from '../capture-format.js';
import { PERSONAL_FIELDS } from '../frame-ring.js';
import { TlsConnections } from '../tls-stream.js';

/** `__dirname`, not `import.meta.url`: `tsconfig.main.json` builds this tree to CommonJS. */
const HERE = __dirname;

const CAPTURES = ['live-capture.bfcc', 'live-capture-caps.bfcc', 'live-capture-combat.bfcc'] as const;
const FIXTURES = ['replay-stream.bin', ...CAPTURES] as const;

function sensitiveKeysIn(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(sensitiveKeysIn);
  if (typeof value !== 'object' || value === null) return [];
  return Object.entries(value).flatMap(([key, child]) => [...(isSensitiveKey(key) ? [key] : []), ...sensitiveKeysIn(child)]);
}

function decodedWireObjects(capture: (typeof CAPTURES)[number]): readonly Record<string, unknown>[] {
  const conn = new TlsConnections();
  const wireObjects: Record<string, unknown>[] = [];
  for (const record of readCaptureRecords(readFileSync(resolve(HERE, capture)))) {
    for (const event of conn.push(record.ctx, record.bytes)) {
      if (event.kind === 'tick') wireObjects.push(event.raw);
    }
  }
  return wireObjects;
}

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
 * Each `.bfcc` capture is a trimmed real session, kept to the single combat-websocket connection
 * (docs/live-logging.md §5) — REST response bodies are the one place `account_id`/`player_name`
 * appear in a capture, so a capture with no REST connection at all carries no account identifiers
 * by construction, not just by the two field names above happening not to match. This does not
 * apply to `replay-stream.bin`: that synthetic fixture deliberately carries an HTTP response as
 * part of its own decoder-resync coverage.
 */
describe.each(CAPTURES)('%s structurally carries no REST connection to leak an identifier from', (capture) => {
  const records = [...readCaptureRecords(readFileSync(resolve(HERE, capture)))];

  it('is on a single connection id, so there is no second, REST connection captured alongside it', () => {
    expect(new Set(records.map((record) => record.ctx)).size).toBe(1);
  });

  it('contains no HTTP response bytes anywhere in any record', () => {
    const offenders = records.filter((record) => Buffer.from(record.bytes).toString('latin1').includes('HTTP/1.'));
    expect(offenders).toEqual([]);
  });
});

describe('sensitiveKeysIn: the guard that finds a credential-named key in a decoded record', () => {
  it('finds a sensitive key at any depth, inside arrays too', () => {
    expect(sensitiveKeysIn({ phase: 1, heroes: [{ id: 'a', session_token: 'x' }], nested: { Authorization: 'y' } })).toEqual([
      'session_token',
      'Authorization',
    ]);
  });

  it('finds nothing in a record with only combat keys', () => {
    expect(sensitiveKeysIn({ phase: 1, heroes: [{ id: 'a', e: 0.5 }], hits: [{ c: 3, d: 100 }] })).toEqual([]);
  });
});

describe.each(CAPTURES)('%s decodes into records with no credential-named key', (capture) => {
  const wireObjects = decodedWireObjects(capture);

  it('decodes at least one record, so the key check below cannot pass vacuously', () => {
    expect(wireObjects.length).toBeGreaterThan(0);
  });

  it('carries no key the scrubber classifies as sensitive in any decoded record', () => {
    expect(wireObjects.flatMap(sensitiveKeysIn)).toEqual([]);
  });
});

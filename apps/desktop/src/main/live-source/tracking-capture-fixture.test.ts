import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  LINKED_PAIR,
  TOKEN_MARKER,
  writeTrackingCapture,
} from '../../../tests/fixtures/premium/tracking-fixtures.mjs';
import { readCaptureRecords } from './capture-format.js';
import { TlsConnections } from './tls-stream.js';

const scratch: string[] = [];
afterEach(() => {
  for (const dir of scratch.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('the tracking replay capture', () => {
  it('holds one body and one frame, each with the planted credential', () => {
    const dir = mkdtempSync(join(tmpdir(), 'bfc-tracking-capture-'));
    scratch.push(dir);
    const file = writeTrackingCapture(join(dir, 'capture.bfcc'));
    const tls = new TlsConnections();
    const events = [...readCaptureRecords(readFileSync(file))].flatMap((record) => tls.push(record.ctx, record.bytes));

    const bodies = events.flatMap((event): Record<string, unknown>[] =>
      event.kind === 'http' && event.body !== undefined
        ? [JSON.parse(event.body.toString('utf8')) as Record<string, unknown>]
        : [],
    );
    const frames = events.flatMap((event): Record<string, unknown>[] => (event.kind === 'tick' ? [event.raw] : []));
    expect(bodies).toHaveLength(1);
    expect(frames).toHaveLength(1);
    for (const item of [bodies[0], frames[0]]) {
      expect(item?.['token']).toBe(TOKEN_MARKER);
      expect(JSON.stringify(item)).toContain(LINKED_PAIR.steamId64);
    }
  });
});

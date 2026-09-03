import { describe, expect, it } from 'vitest';
import { liveGap } from '@bombfarm/contracts';
import { SessionToken } from '@bombfarm/game-api';
import {
  createObservationCapture,
  encodeObservationLine,
  isObservationCaptureEnabled,
  type ObservationCapture,
  type ObservationCaptureDeps,
  type ObservationEnvelope,
  type ObservationRecord,
} from './observation-capture.js';

const SENTINEL_TOKEN = 'sentinel-a1b2c3d4e5f6a1b2c3d4';
const AT = '2026-09-02T04:00:00.000Z';

const BASE_ENVELOPE: ObservationEnvelope = { seq: 7, at: AT, phase: 26, wave: 3, redaction: 'key-name-only' };
const BASE_MARK: ObservationRecord = { ...BASE_ENVELOPE, kind: 'mark', label: 'opened a cage' };

function parseLine(line: string): Record<string, unknown> {
  return JSON.parse(line.slice(0, -1)) as Record<string, unknown>;
}

const ENABLED = { BFC_OBSERVATION_CAPTURE: '1' } as const;

describe('isObservationCaptureEnabled: the full gate table', () => {
  it('stays disabled when packaged even with the enabling variable set', () => {
    expect(isObservationCaptureEnabled(ENABLED, true)).toBe(false);
  });

  it('stays disabled when packaged with the variable unset', () => {
    expect(isObservationCaptureEnabled({}, true)).toBe(false);
  });

  it('is enabled only when unpackaged and the variable is exactly "1"', () => {
    expect(isObservationCaptureEnabled(ENABLED, false)).toBe(true);
  });

  it('stays disabled when unpackaged and the variable is unset', () => {
    expect(isObservationCaptureEnabled({}, false)).toBe(false);
  });

  it('stays disabled for a truthy-looking value that is not "1"', () => {
    expect(isObservationCaptureEnabled({ BFC_OBSERVATION_CAPTURE: 'true' }, false)).toBe(false);
  });

  it('stays disabled for "0"', () => {
    expect(isObservationCaptureEnabled({ BFC_OBSERVATION_CAPTURE: '0' }, false)).toBe(false);
  });

  it('stays disabled for an empty value', () => {
    expect(isObservationCaptureEnabled({ BFC_OBSERVATION_CAPTURE: '' }, false)).toBe(false);
  });
});

describe('encodeObservationLine: the one serialiser', () => {
  it('returns exactly one line ending in a single newline that parses as JSON', () => {
    const line = encodeObservationLine(BASE_MARK, null);

    expect(line.endsWith('\n')).toBe(true);
    expect(line.slice(0, -1)).not.toContain('\n');
    expect(JSON.parse(line.slice(0, -1))).toMatchObject({ kind: 'mark', label: 'opened a cage' });
  });

  it('carries seq, at, phase, wave and redaction on every record', () => {
    const parsed = parseLine(encodeObservationLine(BASE_MARK, null));

    expect(parsed).toMatchObject({ seq: 7, at: AT, phase: 26, wave: 3, redaction: 'key-name-only' });
  });

  it('keeps phase and wave as explicit nulls rather than omitting them before any frame arrives', () => {
    const parsed = parseLine(encodeObservationLine({ ...BASE_MARK, phase: null, wave: null }, null));

    expect(Object.keys(parsed)).toContain('phase');
    expect(Object.keys(parsed)).toContain('wave');
    expect(parsed.phase).toBeNull();
    expect(parsed.wave).toBeNull();
  });

  it('never lets the session token reach the output, at any nesting depth or inside an array', () => {
    const redact = (text: string): string => text.split(SENTINEL_TOKEN).join('[redacted]');
    const line = encodeObservationLine(
      {
        ...BASE_ENVELOPE,
        kind: 'body',
        byteLength: 512,
        verdict: { kind: 'unidentified' },
        body: {
          authorization: `Bearer ${SENTINEL_TOKEN}`,
          nested: { deep: { note: `token is ${SENTINEL_TOKEN}` } },
          list: [SENTINEL_TOKEN, { alsoHere: SENTINEL_TOKEN }],
        },
      },
      redact,
    );

    expect(line).not.toContain(SENTINEL_TOKEN);
    expect(line).toContain('[redacted]');
  });

  it('renders a session-token value as the redaction marker rather than anything derived from it', () => {
    const token = SessionToken.create(SENTINEL_TOKEN);
    const line = encodeObservationLine(
      { ...BASE_ENVELOPE, kind: 'session', event: 'started', detail: { carried: token } },
      null,
    );

    expect(line).not.toContain(SENTINEL_TOKEN);
    expect(parseLine(line).detail).toEqual({ carried: '[redacted]' });
  });

  it('still blanks sensitive-named keys and removes personal fields with no credential redactor installed', () => {
    const line = encodeObservationLine(
      {
        ...BASE_ENVELOPE,
        kind: 'body',
        byteLength: 64,
        verdict: { kind: 'identified', section: 'casa' },
        body: { token: SENTINEL_TOKEN, account_id: '486', player_name: 'someone', phase: 26 },
      },
      null,
    );

    expect(line).not.toContain(SENTINEL_TOKEN);
    expect(parseLine(line).body).toEqual({ token: '[redacted]', phase: 26 });
  });

  it('preserves a wire key the decoded tick does not model', () => {
    const line = encodeObservationLine(
      { ...BASE_ENVELOPE, kind: 'frame', wire: { jaula_state: 2, seca_secs: 41, t: 'snap' } },
      null,
    );

    expect(parseLine(line).wire).toEqual({ jaula_state: 2, seca_secs: 41, t: 'snap' });
  });

  it('keeps an unidentified body complete, since those are the ones the mode exists to record', () => {
    const unknownBody = { cage: { hero: 'Dano', rarity: 'Common' }, unmodelled: [1, 2, 3] };
    const line = encodeObservationLine(
      { ...BASE_ENVELOPE, kind: 'body', byteLength: 99, verdict: { kind: 'unidentified' }, body: unknownBody },
      null,
    );

    expect(parseLine(line)).toMatchObject({ verdict: { kind: 'unidentified' }, byteLength: 99, body: unknownBody });
  });

  it('stamps the armed level once a credential redactor is in play', () => {
    const parsed = parseLine(encodeObservationLine({ ...BASE_MARK, redaction: 'armed' }, (text) => text));

    expect(parsed.redaction).toBe('armed');
  });
});

interface CaptureHarness {
  readonly capture: ObservationCapture;
  readonly lines: string[];
  readonly records: () => Record<string, unknown>[];
  readonly warnings: Record<string, unknown>[];
  readonly infos: Record<string, unknown>[];
}

function createCapture(overrides: Partial<ObservationCaptureDeps> = {}): CaptureHarness {
  const lines: string[] = [];
  const warnings: Record<string, unknown>[] = [];
  const infos: Record<string, unknown>[] = [];
  const capture = createObservationCapture({
    enabled: true,
    isPackaged: false,
    destination: 'C:\\capture\\observed-20260902-040000.ndjson',
    appendPort: { append: (line) => lines.push(line), close: () => undefined },
    log: { info: (record) => infos.push(record), warn: (record) => warnings.push(record) },
    now: () => Date.parse(AT),
    ...overrides,
  });
  return { capture, lines, records: () => lines.map((line) => parseLine(line)), warnings, infos };
}

function bodyBytes(value: unknown): Buffer {
  return Buffer.from(JSON.stringify(value), 'utf8');
}

describe('createObservationCapture: the two gates', () => {
  it('writes nothing and logs nothing when packaged, even with the mode enabled', () => {
    const { capture, lines, warnings, infos } = createCapture({ isPackaged: true, enabled: true });
    capture.body(bodyBytes({ any: 'body' }), 1);
    capture.frame({ phase: 26 }, 2);

    expect(lines).toHaveLength(0);
    expect(warnings).toHaveLength(0);
    expect(infos).toHaveLength(0);
  });

  it('writes nothing when unpackaged but not enabled', () => {
    const { capture, lines } = createCapture({ isPackaged: false, enabled: false });
    capture.body(bodyBytes({ any: 'body' }), 1);

    expect(lines).toHaveLength(0);
  });

  it('does write when unpackaged and enabled, so the gate cannot pass by refusing everything', () => {
    const { capture, records } = createCapture({ isPackaged: false, enabled: true });
    capture.body(bodyBytes({ any: 'body' }), 1);

    expect(records().filter((record) => record.kind === 'body')).toHaveLength(1);
  });
});

describe('createObservationCapture: what it records', () => {
  it('writes a session record naming the destination first, so the file is never empty', () => {
    const { records } = createCapture();

    expect(records()[0]).toMatchObject({
      kind: 'session',
      event: 'started',
      seq: 1,
      detail: { destination: 'C:\\capture\\observed-20260902-040000.ndjson' },
    });
  });

  it('records an unidentified body in full, which is the case the mode exists for', () => {
    const unknown = { cage: { hero: 'Dano', rarity: 'Common' }, reward: [7, 8] };
    const { capture, records } = createCapture();
    capture.body(bodyBytes(unknown), 1_700_000_000_000);

    const record = records().find((entry) => entry.kind === 'body');
    expect(record).toMatchObject({ verdict: { kind: 'unidentified' }, body: unknown });
    expect(record?.byteLength).toBe(bodyBytes(unknown).length);
  });

  it('stamps the identified verdict with its section when the body matches a known shape', () => {
    const knownShapeBody = { casa: { level: 3 }, heroes: [], slots: [] };
    const { capture, records } = createCapture({ identify: () => ({ kind: 'identified', section: 'casa' }) });
    capture.body(bodyBytes(knownShapeBody), 1_700_000_000_000);

    expect(records().find((entry) => entry.kind === 'body')).toMatchObject({
      verdict: { kind: 'identified', section: 'casa' },
      body: knownShapeBody,
    });
  });

  it('records a body that is not JSON with the parse-failure verdict and its byte length', () => {
    const { capture, records } = createCapture();
    capture.body(Buffer.from('not-json-at-all', 'utf8'), 1_700_000_000_000);

    const record = records().find((entry) => entry.kind === 'body');
    expect(record).toMatchObject({ verdict: { kind: 'parse_failed' }, byteLength: 15 });
    expect(record).not.toHaveProperty('body');
  });

  it('keeps a wire key the decoded tick does not model', () => {
    const { capture, records } = createCapture();
    capture.frame({ phase: 26, wave: 3, jaula_state: 2, seca_secs: 41 }, 1_700_000_000_000);

    expect(records().find((entry) => entry.kind === 'frame')?.wire).toEqual({
      phase: 26,
      wave: 3,
      jaula_state: 2,
      seca_secs: 41,
    });
  });

  it('carries the phase and wave a frame established onto every later record', () => {
    const { capture, records } = createCapture();
    capture.frame({ phase: 26, wave: 3 }, 1_700_000_000_000);
    capture.mark('opened a cage', 1_700_000_000_100);

    expect(records().find((entry) => entry.kind === 'mark')).toMatchObject({ phase: 26, wave: 3 });
  });

  it('carries explicit nulls for phase and wave until a frame arrives', () => {
    const { capture, records } = createCapture();
    capture.mark('before any frame', 1_700_000_000_000);

    const record = records().find((entry) => entry.kind === 'mark');
    expect(record).toMatchObject({ phase: null, wave: null });
    expect(Object.keys(record ?? {})).toEqual(expect.arrayContaining(['phase', 'wave']));
  });

  it('records every currency transition, so a run where the tap never attached says why', () => {
    const { capture, records } = createCapture();
    capture.currency(liveGap('consentMissing', AT), 1_700_000_000_000);

    expect(records().find((entry) => entry.event === 'currency')).toMatchObject({
      kind: 'session',
      detail: { currency: { kind: 'gap', reason: 'consentMissing' } },
    });
  });
});

describe('createObservationCapture: repetition', () => {
  /** Deduplicating would hide the very repetition that identifies a polling route, so an identical
   *  body arriving many times must produce that many records. */
  it('records every occurrence of an identical body rather than collapsing them', () => {
    const { capture, records } = createCapture();
    const polled = { casa: { level: 3 }, heroes: [] };
    for (let i = 0; i < 50; i += 1) capture.body(bodyBytes(polled), 1_700_000_000_000 + i);

    const bodies = records().filter((entry) => entry.kind === 'body');
    expect(bodies).toHaveLength(50);
    expect(new Set(bodies.map((entry) => entry.seq)).size).toBe(50);
    expect(bodies.every((entry) => JSON.stringify(entry.body) === JSON.stringify(polled))).toBe(true);
  });
});

describe('createObservationCapture: ordering', () => {
  it('increases the sequence strictly across every record kind, including within one millisecond', () => {
    const { capture, records } = createCapture();
    capture.body(bodyBytes({ a: 1 }), 1_700_000_000_000);
    capture.body(bodyBytes({ b: 2 }), 1_700_000_000_000);
    capture.frame({ phase: 26 }, 1_700_000_000_000);
    capture.mark('same millisecond', 1_700_000_000_000);

    expect(records().map((record) => record.seq)).toEqual([1, 2, 3, 4, 5]);
    expect(new Set(records().slice(1).map((record) => record.at)).size).toBe(1);
  });
});

describe('createObservationCapture: failure', () => {
  it('latches on a throwing append, logs exactly once however many calls arrive, and never throws', () => {
    const warnings: Record<string, unknown>[] = [];
    const capture = createObservationCapture({
      enabled: true,
      isPackaged: false,
      destination: 'unused',
      appendPort: {
        append: () => {
          throw new Error('EACCES: permission denied');
        },
        close: () => undefined,
      },
      log: { info: () => undefined, warn: (record) => warnings.push(record) },
      now: () => Date.parse(AT),
    });

    expect(() => {
      capture.body(bodyBytes({ a: 1 }), 1);
      capture.frame({ phase: 26 }, 2);
      capture.mark('after failure', 3);
      capture.currency(liveGap('neverAttached', AT), 4);
      capture.close();
    }).not.toThrow();
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({ scope: 'observation-capture', event: 'append_failed' });
  });
});

describe('createObservationCapture: the redaction stamp', () => {
  it('stamps key-name-only before a credential redactor is installed and armed after', () => {
    const { capture, records } = createCapture();
    capture.mark('before', 1_700_000_000_000);
    capture.setCredentialRedactor((text) => text);
    capture.mark('after', 1_700_000_000_100);

    const marks = records().filter((entry) => entry.kind === 'mark');
    expect(marks[0]).toMatchObject({ label: 'before', redaction: 'key-name-only' });
    expect(marks[1]).toMatchObject({ label: 'after', redaction: 'armed' });
  });

  it('records the arming transition itself, once, so a reader can locate it in the stream', () => {
    const { capture, records } = createCapture();
    capture.setCredentialRedactor((text) => text);
    capture.setCredentialRedactor((text) => text);

    expect(records().filter((entry) => entry.event === 'redactor_armed')).toHaveLength(1);
  });

  it('runs the installed redactor over every later record before it reaches the file', () => {
    const { capture, lines } = createCapture();
    capture.setCredentialRedactor((text) => text.split(SENTINEL_TOKEN).join('[redacted]'));
    capture.body(bodyBytes({ note: `carries ${SENTINEL_TOKEN} inline` }), 1_700_000_000_000);

    expect(lines.join('')).not.toContain(SENTINEL_TOKEN);
  });
});

describe('createObservationCapture: closing', () => {
  it('writes a stopped record and closes the append port', () => {
    const closeCalls = { count: 0 };
    const lines: string[] = [];
    const capture = createObservationCapture({
      enabled: true,
      isPackaged: false,
      destination: 'unused',
      appendPort: {
        append: (line) => lines.push(line),
        close: () => {
          closeCalls.count += 1;
        },
      },
      log: { info: () => undefined, warn: () => undefined },
      now: () => Date.parse(AT),
    });
    capture.close();

    expect(JSON.parse(lines[lines.length - 1]?.slice(0, -1) ?? '{}')).toMatchObject({
      kind: 'session',
      event: 'stopped',
    });
    expect(closeCalls.count).toBe(1);
  });
});

import { describe, expect, it } from 'vitest';
import { SessionToken } from '@bombfarm/game-api';
import {
  encodeObservationLine,
  isObservationCaptureEnabled,
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

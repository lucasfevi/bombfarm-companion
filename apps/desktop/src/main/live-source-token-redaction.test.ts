/**
 * The tap starts delivering frames the moment `liveSource.start()` runs, but the account cycle's
 * first token read — the one that hands the live source its credential redactor — only comes
 * after boot has awaited the main window. Anything the frame ring or the developer capture holds
 * from that window is scrubbed by key name alone, so a token sitting under any other key reaches
 * disk in clear. These tests drive the real ring and the real capture through the real reader.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SessionToken, initialConsent, type ConsentRecord, type GrantedConsent } from '@bombfarm/game-api';

import { armCredentialRedactor, createRedactingTokenReader, type CredentialRedactorSink } from './redacting-token-reader.js';
import { FrameRing } from './live-source/frame-ring.js';
import { createObservationCapture, type ObservationCapture } from './live-source/observation-capture.js';
import type { SessionTokenFileResult } from './game-api/session-token-file.js';

const MARKER_TOKEN = 'sTkn-marker-9f8e7d6c5b4a3210';

const GRANTED: GrantedConsent = {
  decision: 'granted',
  grantedAt: '2026-11-02T00:00:00.000Z',
  textVersion: 1,
};

const NOOP_LOG = { info: () => undefined, warn: () => undefined };

function okResult(): SessionTokenFileResult {
  return { ok: true, accountId: 'acct-1', token: SessionToken.create(MARKER_TOKEN), mtimeMs: 1 };
}

/** Boot as `index.ts` composes it: the ring and the capture behind one sink that forwards the
 *  redactor to both, the way `LiveSource.setCredentialRedactor` does. */
function bootLiveSinks(consent: ConsentRecord) {
  const dumps: string[] = [];
  const lines: string[] = [];
  const ring = new FrameRing({
    maxFrames: 16,
    maxBytes: 64_000,
    dumpPath: 'live-frame-dump.json',
    writePort: { write: (_destination, contents) => dumps.push(contents) },
  });
  const capture: ObservationCapture = createObservationCapture({
    enabled: true,
    isPackaged: false,
    destination: 'observed.ndjson',
    appendPort: { append: (line) => lines.push(line), close: () => undefined },
    log: NOOP_LOG,
  });
  const liveSource: CredentialRedactorSink = {
    setCredentialRedactor: (redact) => {
      ring.setCredentialRedactor(redact);
      capture.setCredentialRedactor(redact);
    },
  };
  const readToken = createRedactingTokenReader({
    readToken: okResult,
    logSink: { setCredentialRedactor: () => undefined },
    getLiveSource: () => liveSource,
  });
  return { ring, capture, dumps, lines, readToken, readConsent: () => consent };
}

/** A frame and a body that carry the token under keys the key-name scrub does not know, plus one
 *  that is not JSON at all — the three shapes that only a value redactor can catch. */
function observeTokenBearingTraffic(ring: FrameRing, capture: ObservationCapture): void {
  const frame = { echo: MARKER_TOKEN, nested: { note: `session ${MARKER_TOKEN}` } };
  ring.push(Buffer.from(JSON.stringify(frame), 'utf8'));
  ring.push(Buffer.from(`not-json ${MARKER_TOKEN}`, 'utf8'));
  capture.frame(frame, 1_700_000_000_000);
  capture.body(Buffer.from(JSON.stringify({ relay: MARKER_TOKEN }), 'utf8'), 1_700_000_000_100);
}

describe('the session token never reaches the frame dump or the capture file', () => {
  it('is armed before the first frame, so traffic seen at boot is redacted by value', () => {
    const boot = bootLiveSinks(GRANTED);

    armCredentialRedactor({ readConsent: boot.readConsent, readToken: boot.readToken });
    observeTokenBearingTraffic(boot.ring, boot.capture);
    boot.ring.dumpToDisk('parse-failure');

    expect(boot.dumps).toHaveLength(1);
    expect(boot.dumps.join('\n')).not.toContain(MARKER_TOKEN);
    expect(boot.lines.length).toBeGreaterThan(0);
    expect(boot.lines.join('')).not.toContain(MARKER_TOKEN);
    expect(boot.lines.join('')).not.toContain('"redaction":"key-name-only"');
  });

  it('without arming, the same traffic does reach the capture in clear — the gap this closes', () => {
    const boot = bootLiveSinks(GRANTED);

    observeTokenBearingTraffic(boot.ring, boot.capture);

    expect(boot.lines.join('')).toContain(MARKER_TOKEN);
  });

  it('does not read the token file without account consent', () => {
    let reads = 0;
    armCredentialRedactor({
      readConsent: initialConsent,
      readToken: () => {
        reads += 1;
        return okResult();
      },
    });

    expect(reads).toBe(0);
  });
});

describe('index.ts arms the redactor between building the live source and starting it', () => {
  const source = readFileSync(resolve(__dirname, 'index.ts'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

  it('calls armCredentialRedactor after `new LiveSource({` and before `liveSource.start()`', () => {
    const built = source.indexOf('liveSource = new LiveSource({');
    const started = source.indexOf('liveSource.start();');
    const armed = source.indexOf('armCredentialRedactor(', built);

    expect(built).toBeGreaterThan(-1);
    expect(started).toBeGreaterThan(built);
    expect(armed).toBeGreaterThan(built);
    expect(armed).toBeLessThan(started);
  });
});

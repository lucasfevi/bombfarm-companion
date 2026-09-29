import { describe, expect, it } from 'vitest';
import { SessionToken, type GrantedConsent } from '@bombfarm/game-api';

import { createRedactingTokenReader, type CredentialRedactorSink } from './redacting-token-reader.js';
import type { SessionTokenFileResult } from './game-api/session-token-file.js';

type Redactor = (text: string) => string;

function recordingSink(): CredentialRedactorSink & { installed: (Redactor | null)[] } {
  const installed: (Redactor | null)[] = [];
  return {
    installed,
    setCredentialRedactor: (redact) => {
      installed.push(redact);
    },
  };
}

const GRANTED: GrantedConsent = {
  decision: 'granted',
  grantedAt: '2026-09-29T00:00:00.000Z',
  textVersion: 1,
};

const RAW_TOKEN = 'sTkn-wired-4c3b2a1908f7e6d5';

function okResult(raw = RAW_TOKEN): SessionTokenFileResult {
  return { ok: true, accountId: 'acct-1', token: SessionToken.create(raw), mtimeMs: 1 };
}

const FAILED_READ: SessionTokenFileResult = { ok: false, reason: 'not_found' };

describe('createRedactingTokenReader on a successful read', () => {
  it('installs a redactor on both the log sink and the live source', () => {
    const logSink = recordingSink();
    const liveSource = recordingSink();
    const read = createRedactingTokenReader({
      readToken: () => okResult(),
      logSink,
      getLiveSource: () => liveSource,
    });

    read(GRANTED);

    expect(logSink.installed).toHaveLength(1);
    expect(liveSource.installed).toHaveLength(1);
  });

  it('masks the real token value out of text handed to the log sink redactor', () => {
    const logSink = recordingSink();
    const read = createRedactingTokenReader({
      readToken: () => okResult(),
      logSink,
      getLiveSource: () => null,
    });

    read(GRANTED);
    const redact = logSink.installed[0];

    expect(redact?.(`refresh failed near ${RAW_TOKEN}`)).toBe('refresh failed near [redacted]');
  });

  it('masks the real token value out of text handed to the live-source redactor', () => {
    const liveSource = recordingSink();
    const read = createRedactingTokenReader({
      readToken: () => okResult(),
      logSink: recordingSink(),
      getLiveSource: () => liveSource,
    });

    read(GRANTED);
    const redact = liveSource.installed[0];

    expect(redact?.(`{"auth":"${RAW_TOKEN}"}`)).toBe('{"auth":"[redacted]"}');
  });

  it('returns the read result unchanged, so callers still see the account it names', () => {
    const result = okResult();
    const read = createRedactingTokenReader({
      readToken: () => result,
      logSink: recordingSink(),
      getLiveSource: () => null,
    });

    expect(read(GRANTED)).toBe(result);
  });

  it('installs the later token on both sinks when the file is read a second time', () => {
    const logSink = recordingSink();
    const liveSource = recordingSink();
    const second = 'sTkn-rotated-0011223344556677';
    let raw = RAW_TOKEN;
    const read = createRedactingTokenReader({
      readToken: () => okResult(raw),
      logSink,
      getLiveSource: () => liveSource,
    });

    read(GRANTED);
    raw = second;
    read(GRANTED);

    expect(logSink.installed[1]?.(second)).toBe('[redacted]');
    expect(liveSource.installed[1]?.(second)).toBe('[redacted]');
  });

  it('asks for the live source on every read, so one built after boot still gets the redactor', () => {
    const liveSource = recordingSink();
    let current: CredentialRedactorSink | null = null;
    const read = createRedactingTokenReader({
      readToken: () => okResult(),
      logSink: recordingSink(),
      getLiveSource: () => current,
    });

    read(GRANTED);
    current = liveSource;
    read(GRANTED);

    expect(liveSource.installed).toHaveLength(1);
  });
});

describe('createRedactingTokenReader on a failed read', () => {
  it('installs on neither sink, leaving no stale or no-op redactor behind', () => {
    const logSink = recordingSink();
    const liveSource = recordingSink();
    const read = createRedactingTokenReader({
      readToken: () => FAILED_READ,
      logSink,
      getLiveSource: () => liveSource,
    });

    read(GRANTED);

    expect(logSink.installed).toEqual([]);
    expect(liveSource.installed).toEqual([]);
  });

  it('returns the failure unchanged', () => {
    const read = createRedactingTokenReader({
      readToken: () => FAILED_READ,
      logSink: recordingSink(),
      getLiveSource: () => null,
    });

    expect(read(GRANTED)).toEqual({ ok: false, reason: 'not_found' });
  });
});

describe('createRedactingTokenReader with no live source yet', () => {
  it('does not throw and still installs on the log sink', () => {
    const logSink = recordingSink();
    const read = createRedactingTokenReader({
      readToken: () => okResult(),
      logSink,
      getLiveSource: () => null,
    });

    expect(() => read(GRANTED)).not.toThrow();
    expect(logSink.installed[0]?.(RAW_TOKEN)).toBe('[redacted]');
  });
});

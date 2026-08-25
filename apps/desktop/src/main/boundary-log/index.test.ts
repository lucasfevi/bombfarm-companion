import { SessionToken } from '@bombfarm/game-api';
import { describe, expect, it } from 'vitest';
import { createBoundaryLog } from './index.js';

function fakeClock(startAt = 0): { now: () => number; advance(ms: number): void } {
  let current = startAt;
  return {
    now: () => current,
    advance: (ms: number) => {
      current += ms;
    },
  };
}

function captureTransport(): {
  transport: {
    info(record: Record<string, unknown>): void;
    warn(record: Record<string, unknown>): void;
    error(record: Record<string, unknown>): void;
    debug(record: Record<string, unknown>): void;
  };
  captured: Record<string, unknown>[];
} {
  const captured: Record<string, unknown>[] = [];
  return {
    transport: {
      info: (record) => captured.push(record),
      warn: (record) => captured.push(record),
      error: (record) => captured.push(record),
      debug: (record) => captured.push(record),
    },
    captured,
  };
}

describe('createBoundaryLog', () => {
  it('never lets a registered session token, an account id, or a player name reach the transport', () => {
    const { transport, captured } = captureTransport();
    const boundaryLog = createBoundaryLog({ transport, now: fakeClock().now });

    const sessionToken = 'sTkn-9f8e7d6c5b4a3210-live';
    boundaryLog.registerSecret(sessionToken);

    boundaryLog.info({
      scope: 'game-api',
      event: 'account.refresh',
      account_id: 'acct-778899',
      playerName: 'CommanderVex',
      sessionToken,
      error: `refresh failed for token ${sessionToken} - upstream rejected`,
    });
    boundaryLog.flush();

    const dump = JSON.stringify(captured);
    expect(dump).not.toContain('acct-778899');
    expect(dump).not.toContain('CommanderVex');
    expect(dump).not.toContain(sessionToken);
  });

  it('routes info, warn, and error records to the matching transport method, deduped independently', () => {
    const { transport, captured } = captureTransport();
    const levels: string[] = [];
    const trackedTransport = {
      info: (record: Record<string, unknown>) => {
        levels.push('info');
        transport.info(record);
      },
      warn: (record: Record<string, unknown>) => {
        levels.push('warn');
        transport.warn(record);
      },
      error: (record: Record<string, unknown>) => {
        levels.push('error');
        transport.error(record);
      },
      debug: (record: Record<string, unknown>) => {
        levels.push('debug');
        transport.debug(record);
      },
    };
    const boundaryLog = createBoundaryLog({ transport: trackedTransport, now: fakeClock().now });

    boundaryLog.info({ scope: 'live-source', event: 'tap.started' });
    boundaryLog.warn({ scope: 'live-source', event: 'tap.retry' });
    boundaryLog.error({ scope: 'live-source', event: 'tap.failed' });
    boundaryLog.debug({ scope: 'live-source', event: 'tap.debug' });

    expect(levels).toEqual(['info', 'warn', 'error', 'debug']);
    expect(captured).toHaveLength(4);
  });

  it('routes a debug record to the debug transport only, never info', () => {
    const infoRecords: Record<string, unknown>[] = [];
    const debugRecords: Record<string, unknown>[] = [];
    const boundaryLog = createBoundaryLog({
      transport: {
        info: (record) => infoRecords.push(record),
        warn: () => undefined,
        error: () => undefined,
        debug: (record) => debugRecords.push(record),
      },
      now: fakeClock().now,
    });

    boundaryLog.debug({ scope: 'game-reader', event: 'ipc.debug' });

    expect(debugRecords).toHaveLength(1);
    expect(infoRecords).toHaveLength(0);
  });

  it('emits the suppressed-count summary at the same severity the first occurrence used', () => {
    const { transport, captured } = captureTransport();
    const levels: string[] = [];
    const trackedTransport = {
      info: (record: Record<string, unknown>) => {
        levels.push('info');
        transport.info(record);
      },
      warn: (record: Record<string, unknown>) => {
        levels.push('warn');
        transport.warn(record);
      },
      error: (record: Record<string, unknown>) => {
        levels.push('error');
        transport.error(record);
      },
      debug: (record: Record<string, unknown>) => {
        levels.push('debug');
        transport.debug(record);
      },
    };
    const boundaryLog = createBoundaryLog({ transport: trackedTransport, now: fakeClock().now });

    boundaryLog.warn({ scope: 'live-source', event: 'tap.retry' });
    boundaryLog.warn({ scope: 'live-source', event: 'tap.retry' });
    boundaryLog.flush();

    expect(levels).toEqual(['warn', 'warn']);
    expect(captured[1]).toMatchObject({ suppressedCount: 1 });
  });

  it('redacts a record before it reaches the dedup key, so a secret cannot leak through a summary', () => {
    const { transport, captured } = captureTransport();
    const boundaryLog = createBoundaryLog({ transport, now: fakeClock().now });
    const sessionToken = 'sTkn-abc123def456';
    boundaryLog.registerSecret(sessionToken);

    boundaryLog.info({ scope: 'game-api', event: 'account.refresh', sessionToken });
    boundaryLog.info({ scope: 'game-api', event: 'account.refresh', sessionToken });
    boundaryLog.flush();

    expect(JSON.stringify(captured)).not.toContain(sessionToken);
  });

  it('strips a real SessionToken value out of a free-text field via setCredentialRedactor', () => {
    const { transport, captured } = captureTransport();
    const boundaryLog = createBoundaryLog({ transport, now: fakeClock().now });
    const rawValue = 'sTkn-composed-9f8e7d6c5b4a3210';
    const token = SessionToken.create(rawValue);
    boundaryLog.setCredentialRedactor((text) => token.redactFrom(text));

    boundaryLog.info({ scope: 'game-api', event: 'account.refresh', error: `refresh failed near ${rawValue}` });
    boundaryLog.flush();

    expect(JSON.stringify(captured)).not.toContain(rawValue);
  });
});

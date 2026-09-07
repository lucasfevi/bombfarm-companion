import { describe, expect, it } from 'vitest';
import type { AccountSource } from '@bombfarm/contracts';
import type { ConsentRecord, GrantedConsent } from '@bombfarm/game-api';
import { READ_PACING, SessionToken } from '@bombfarm/game-api';
import { consentRecord, grantedConsent } from '@bombfarm/game-api/test-fixtures';
import { requestAccountRead, type AccountReadRequestDeps } from './account-read-request.js';
import type { SessionTokenFileResult } from './session-token-file.js';
import { createTriggeredRefresh } from './triggered-refresh.js';

const SENTINEL_TOKEN = 'sentinel-account-read-request-4f0c7a13-do-not-leak';

const GRANTED = grantedConsent('2026-09-06T10:00:00.000Z');
const DECLINED = consentRecord({ decision: 'declined' });

function readableToken(): (consent: GrantedConsent) => SessionTokenFileResult {
  return () => ({ ok: true, accountId: '486', token: SessionToken.create(SENTINEL_TOKEN), mtimeMs: 1 });
}

function harness(
  overrides: {
    consent?: ConsentRecord;
    accountSource?: AccountSource;
    gameRunning?: boolean;
    readToken?: (consent: GrantedConsent) => SessionTokenFileResult;
    withTrigger?: boolean;
  } = {},
) {
  let nowMs = 0;
  let reads = 0;
  const trigger = createTriggeredRefresh({
    refreshNow: () => {
      reads += 1;
      return Promise.resolve(null);
    },
    now: () => nowMs,
  });
  const deps: AccountReadRequestDeps = {
    consentStore: { read: () => overrides.consent ?? GRANTED },
    accountSource: () => overrides.accountSource ?? 'server',
    isGameRunning: () => overrides.gameRunning ?? true,
    readToken: overrides.readToken ?? readableToken(),
    triggeredRefresh: () => (overrides.withTrigger === false ? null : trigger),
  };
  return {
    request: () => requestAccountRead(deps),
    advance: (ms: number) => {
      nowMs += ms;
    },
    getReads: () => reads,
  };
}

describe('requestAccountRead', () => {
  it('starts a read when it can', () => {
    const { request, getReads } = harness();

    expect(request()).toEqual({ ok: true });
    expect(getReads()).toBe(1);
  });

  it('refuses a second press inside the manual-refresh floor, and starts one again past it', () => {
    const { request, advance, getReads } = harness();

    expect(request()).toEqual({ ok: true });
    expect(request()).toEqual({ ok: false, reason: 'rate_limited' });
    advance(READ_PACING.manualRefreshFloorMs - 1);
    expect(request()).toEqual({ ok: false, reason: 'rate_limited' });
    expect(getReads()).toBe(1);

    advance(1);
    expect(request()).toEqual({ ok: true });
    expect(getReads()).toBe(2);
  });

  it('refuses a fixture account, which has no server to read from', () => {
    const { request, getReads } = harness({ accountSource: 'fixture' });

    expect(request()).toEqual({ ok: false, reason: 'offline' });
    expect(getReads()).toBe(0);
  });

  it('refuses without consent, and never reads the token file to find that out', () => {
    const { request, getReads } = harness({
      consent: DECLINED,
      readToken: () => {
        throw new Error('the token file must never be opened without consent');
      },
    });

    expect(request()).toEqual({ ok: false, reason: 'not_consented' });
    expect(getReads()).toBe(0);
  });

  it('refuses while the game is not running', () => {
    const { request, getReads } = harness({ gameRunning: false });

    expect(request()).toEqual({ ok: false, reason: 'game_not_running' });
    expect(getReads()).toBe(0);
  });

  it('refuses when the session token cannot be read', () => {
    const { request, getReads } = harness({ readToken: () => ({ ok: false, reason: 'not_found' }) });

    expect(request()).toEqual({ ok: false, reason: 'token_unavailable' });
    expect(getReads()).toBe(0);
  });

  it('refuses before the reader exists, rather than reporting a read it never started', () => {
    const { request, getReads } = harness({ withTrigger: false });

    expect(request()).toEqual({ ok: false, reason: 'unavailable' });
    expect(getReads()).toBe(0);
  });

  it('never answers a refusal a caller cannot print — every reason is one the screen has words for', () => {
    const reasons = [
      harness({ accountSource: 'fixture' }).request(),
      harness({ consent: DECLINED }).request(),
      harness({ gameRunning: false }).request(),
      harness({ readToken: () => ({ ok: false, reason: 'unreadable' }) }).request(),
      harness({ withTrigger: false }).request(),
    ];

    expect(reasons.map((result) => (result.ok ? 'ok' : result.reason))).toEqual([
      'offline',
      'not_consented',
      'game_not_running',
      'token_unavailable',
      'unavailable',
    ]);
  });
});

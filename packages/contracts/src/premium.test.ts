import { describe, expect, it } from 'vitest';
import {
  GAME_ACCOUNT_REPORT_FIELDS,
  PREMIUM_REFRESH_EVERY_MS,
  PREMIUM_REFRESH_FLOOR_MS,
  PREMIUM_SIGN_IN_TIMEOUT_MS,
  isSteamId64,
  readHandOffBody,
  readPremiumMeBody,
  readPremiumStatusBody,
  readPremiumVisibilityBody,
  readReportBody,
  readSessionTokenBody,
  readSignInRequestBody,
} from './premium.js';

const STATUS_BODY = {
  active: true,
  kinds: ['subscription', 'pass'],
  until: '2026-12-01T00:00:00Z',
  entitlements: [{ id: 'e1', kind: 'subscription' }],
  notices: [{ code: 'x' }],
  pendingPass: null,
  pendingPasses: [],
  states: {
    awaitingPayment: { until: '2026-11-01T00:00:00Z' },
    grace: { until: '2026-11-05T00:00:00Z' },
    cancellationScheduled: { at: '2026-12-01T00:00:00Z' },
    paymentFailed: true,
    pendingFirstPayment: false,
    disputeHold: true,
    purchaseBlocked: false,
    regionBlocked: false,
  },
};

const ME_BODY = {
  v: 1,
  signInMethods: ['discord', 'steam'],
  steamVerified: true,
  gameAccountLinked: false,
  admitted: true,
};

function without(body: Record<string, unknown>, key: string): Record<string, unknown> {
  return Object.fromEntries(Object.entries(body).filter(([name]) => name !== key));
}

const NOT_OBJECTS: ReadonlyArray<readonly [string, unknown]> = [
  ['null', null],
  ['an array', []],
  ['a string', 'x'],
  ['a number', 3],
];

function refusals(...extra: Array<readonly [string, unknown]>): ReadonlyArray<readonly [string, unknown]> {
  return [...NOT_OBJECTS, ...extra];
}

describe('premium timing constants', () => {
  it('holds the floor, the cadence and the sign-in window', () => {
    expect([PREMIUM_REFRESH_FLOOR_MS, PREMIUM_REFRESH_EVERY_MS, PREMIUM_SIGN_IN_TIMEOUT_MS]).toEqual([
      30_000, 3_600_000, 300_000,
    ]);
  });
});

describe('readPremiumStatusBody', () => {
  it('maps the status the API sends and drops the keys the app does not show', () => {
    expect(readPremiumStatusBody(STATUS_BODY)).toEqual({
      active: true,
      kinds: ['subscription', 'pass'],
      until: '2026-12-01T00:00:00Z',
      awaitingPaymentUntil: '2026-11-01T00:00:00Z',
      graceUntil: '2026-11-05T00:00:00Z',
      cancellationAt: '2026-12-01T00:00:00Z',
      paymentFailed: true,
      pendingFirstPayment: false,
      disputeHold: true,
    });
  });

  it('keeps no entitlements, purchase block or region block', () => {
    const status = readPremiumStatusBody(STATUS_BODY) as unknown as Record<string, unknown>;
    expect(Object.keys(status)).not.toContain('entitlements');
    expect(Object.keys(status)).not.toContain('purchaseBlocked');
    expect(Object.keys(status)).not.toContain('regionBlocked');
    expect(Object.keys(status)).not.toContain('notices');
  });

  it('reads an inactive status with every state empty', () => {
    const body = {
      active: false,
      kinds: [],
      until: null,
      states: {
        awaitingPayment: null,
        grace: null,
        cancellationScheduled: null,
        paymentFailed: false,
        pendingFirstPayment: false,
        disputeHold: false,
      },
    };
    expect(readPremiumStatusBody(body)).toEqual({
      active: false,
      kinds: [],
      until: null,
      awaitingPaymentUntil: null,
      graceUntil: null,
      cancellationAt: null,
      paymentFailed: false,
      pendingFirstPayment: false,
      disputeHold: false,
    });
  });

  it('drops unknown kinds and repeats', () => {
    const body = { ...STATUS_BODY, kinds: ['pass', 'gift_card', 'pass', 7, 'manual_grant'] };
    expect(readPremiumStatusBody(body)?.kinds).toEqual(['pass', 'manual_grant']);
  });

  it.each(NOT_OBJECTS)('refuses %s', (_name, body) => {
    expect(readPremiumStatusBody(body)).toBeNull();
  });

  it.each(['active', 'kinds', 'until', 'states'])('refuses a body without %s', (key) => {
    expect(readPremiumStatusBody(without(STATUS_BODY, key))).toBeNull();
  });

  it.each([
    ['active as text', { active: 'yes' }],
    ['kinds as text', { kinds: 'pass' }],
    ['until as a number', { until: 5 }],
    ['states as an array', { states: [] }],
  ])('refuses %s', (_name, patch) => {
    expect(readPremiumStatusBody({ ...STATUS_BODY, ...patch })).toBeNull();
  });

  it.each([
    'awaitingPayment',
    'grace',
    'cancellationScheduled',
    'paymentFailed',
    'pendingFirstPayment',
    'disputeHold',
  ])('refuses states without %s', (key) => {
    expect(readPremiumStatusBody({ ...STATUS_BODY, states: without(STATUS_BODY.states, key) })).toBeNull();
  });

  it.each([
    ['awaitingPayment without a date', { awaitingPayment: {} }],
    ['grace as text', { grace: 'soon' }],
    ['cancellationScheduled with a numeric date', { cancellationScheduled: { at: 4 } }],
    ['paymentFailed as text', { paymentFailed: 'true' }],
    ['pendingFirstPayment as a number', { pendingFirstPayment: 1 }],
    ['disputeHold as null', { disputeHold: null }],
  ])('refuses %s', (_name, patch) => {
    expect(readPremiumStatusBody({ ...STATUS_BODY, states: { ...STATUS_BODY.states, ...patch } })).toBeNull();
  });
});

describe('readPremiumMeBody', () => {
  it('keeps the four fields and nothing else', () => {
    const body = { ...ME_BODY, userId: 'u1', audience: 'a', mode: 'm', steamId64: '76561198000000000' };
    const me = readPremiumMeBody(body);
    expect(me).toEqual({
      methods: ['discord', 'steam'],
      steamVerified: true,
      gameAccountLinked: false,
      admitted: true,
    });
    expect(Object.keys(me as object).sort()).toEqual(['admitted', 'gameAccountLinked', 'methods', 'steamVerified']);
  });

  it('drops unknown sign-in methods', () => {
    expect(readPremiumMeBody({ ...ME_BODY, signInMethods: ['steam', 'carrier-pigeon', 'google'] })?.methods).toEqual([
      'steam',
      'google',
    ]);
  });

  it.each(NOT_OBJECTS)('refuses %s', (_name, body) => {
    expect(readPremiumMeBody(body)).toBeNull();
  });

  it.each([
    ['another version', { ...ME_BODY, v: 2 }],
    ['no version', without(ME_BODY, 'v')],
    ['sign-in methods as text', { ...ME_BODY, signInMethods: 'steam' }],
    ['steamVerified as text', { ...ME_BODY, steamVerified: 'true' }],
    ['gameAccountLinked as a number', { ...ME_BODY, gameAccountLinked: 0 }],
    ['admitted as null', { ...ME_BODY, admitted: null }],
  ])('refuses %s', (_name, body) => {
    expect(readPremiumMeBody(body)).toBeNull();
  });

  it.each(['signInMethods', 'steamVerified', 'gameAccountLinked', 'admitted'])('refuses a body without %s', (key) => {
    expect(readPremiumMeBody(without(ME_BODY, key))).toBeNull();
  });
});

describe('readPremiumVisibilityBody', () => {
  it('reads both answers and tolerates extra keys', () => {
    expect(readPremiumVisibilityBody({ visible: true, extra: 1 })).toBe(true);
    expect(readPremiumVisibilityBody({ visible: false })).toBe(false);
  });

  it.each(refusals(['a missing key', {}], ['visible as text', { visible: 'true' }]))('refuses %s', (_n, body) => {
    expect(readPremiumVisibilityBody(body)).toBeNull();
  });
});

describe('readSessionTokenBody', () => {
  const body = { token: 't', expiresAt: '2026-11-01T00:00:00Z', rotateAfter: '2026-10-20T00:00:00Z' };

  it('reads the three strings and tolerates extra keys', () => {
    expect(readSessionTokenBody({ ...body, extra: 1 })).toEqual(body);
  });

  it.each(NOT_OBJECTS)('refuses %s', (_name, value) => {
    expect(readSessionTokenBody(value)).toBeNull();
  });

  it.each(['token', 'expiresAt', 'rotateAfter'])('refuses a body without %s', (key) => {
    expect(readSessionTokenBody(without(body, key))).toBeNull();
  });

  it.each(['token', 'expiresAt', 'rotateAfter'])('refuses %s that is not a string', (key) => {
    expect(readSessionTokenBody({ ...body, [key]: 5 })).toBeNull();
  });
});

describe('readSignInRequestBody', () => {
  it('reads an https approval URL and tolerates extra keys', () => {
    expect(readSignInRequestBody({ approvalUrl: 'https://example.test/a?b=1', expiresAt: 'x' })).toEqual({
      approvalUrl: 'https://example.test/a?b=1',
    });
  });

  it.each(
    refusals(
      ['a missing URL', {}],
      ['a URL that is not text', { approvalUrl: 5 }],
      ['a URL that does not parse', { approvalUrl: 'not a url' }],
      ['an http URL', { approvalUrl: 'http://example.test/a' }],
      ['a file URL', { approvalUrl: 'file:///c:/x' }],
      ['a javascript URL', { approvalUrl: 'javascript:alert(1)' }],
    ),
  )('refuses %s', (_name, body) => {
    expect(readSignInRequestBody(body)).toBeNull();
  });
});

describe('readHandOffBody', () => {
  it('reads an https URL and tolerates extra keys', () => {
    expect(readHandOffBody({ url: 'https://example.test/h', expiresAt: 'x' })).toEqual({
      url: 'https://example.test/h',
    });
  });

  it.each(
    refusals(
      ['a missing URL', {}],
      ['a URL that is not text', { url: null }],
      ['a URL that does not parse', { url: '::::' }],
      ['an http URL', { url: 'http://example.test/h' }],
      ['a custom scheme', { url: 'steam://run/1' }],
    ),
  )('refuses %s', (_name, body) => {
    expect(readHandOffBody(body)).toBeNull();
  });
});

describe('readReportBody', () => {
  it('maps a linked 200 to linked', () => {
    expect(readReportBody(200, { outcome: 'linked' })).toEqual({ kind: 'linked' });
  });

  it.each([
    ['another outcome', { outcome: 'pending' }],
    ['no outcome', {}],
    ['no body', null],
  ])('maps a 200 with %s to failed', (_name, body) => {
    expect(readReportBody(200, body)).toEqual({ kind: 'failed' });
  });

  it.each(['steam_mismatch', 'no_steam_id', 'game_account_taken'] as const)('maps a 409 %s to refused with that reason', (reason) => {
    expect(readReportBody(409, { reason })).toEqual({ kind: 'refused', reason });
  });

  it.each([
    ['another reason', { reason: 'brand_new' }],
    ['no reason', {}],
    ['no body', null],
  ])('maps a 409 with %s to refused unknown', (_name, body) => {
    expect(readReportBody(409, body)).toEqual({ kind: 'refused', reason: 'unknown' });
  });

  it.each([201, 204, 400, 401, 404, 429, 500, 503])('maps %i to failed', (status) => {
    expect(readReportBody(status, { outcome: 'linked', reason: 'steam_mismatch' })).toEqual({ kind: 'failed' });
  });
});

describe('game-account report fields', () => {
  it('lists exactly the two the API accepts', () => {
    expect(GAME_ACCOUNT_REPORT_FIELDS).toEqual(['account_id', 'steam_id64']);
  });
});

describe('isSteamId64', () => {
  it('accepts seventeen digits', () => {
    expect(isSteamId64('76561198000000000')).toBe(true);
  });

  it.each(['', '7656119800000000', '765611980000000000', '7656119800000000a', ' 76561198000000000', '7656119800000000.'])(
    'refuses %j',
    (value) => {
      expect(isSteamId64(value)).toBe(false);
    },
  );
});

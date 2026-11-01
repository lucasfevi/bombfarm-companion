import { describe, expect, it } from 'vitest';
import { createPremiumApi, type LicenceAnswer, type LicenceOutcome } from './premium-api.js';
import type { PremiumHttp, PremiumHttpRequest, PremiumHttpResponse } from './premium-transport.js';

const TOKEN = 'desktop-token-for-tests';
const CALL = { device: 'key.1700000000.sig', body: '{ "exact" : "bytes" }' };

const ENVELOPE = { lease: 'bGVhc2U', sig: 'c2ln', keyId: 'lCwiDkHw' };

function reply(
  status: number,
  body: unknown = '',
  extra: { retryAfterSec?: number; dateMs?: number } = {},
): PremiumHttpResponse {
  return {
    status,
    body: typeof body === 'string' ? body : JSON.stringify(body),
    retryAfterSec: extra.retryAfterSec ?? null,
    ...(extra.dateMs === undefined ? {} : { dateMs: extra.dateMs }),
  };
}

function harness(answer: PremiumHttpResponse | Error) {
  const sent: PremiumHttpRequest[] = [];
  const http: PremiumHttp = (req) => {
    sent.push(req);
    return answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer);
  };
  return { api: createPremiumApi(http), sent };
}

type Route = 'salt' | 'activate' | 'lease' | 'cleanup';

function call(api: ReturnType<typeof createPremiumApi>, route: Route): Promise<LicenceAnswer> {
  switch (route) {
    case 'salt':
      return api.fetchLicenceSalt(TOKEN);
    case 'activate':
      return api.activateLicence(TOKEN, CALL);
    case 'lease':
      return api.renewLease(TOKEN, CALL);
    case 'cleanup':
      return api.reportCleanup(TOKEN, CALL);
  }
}

async function outcomeOf(route: Route, response: PremiumHttpResponse): Promise<LicenceOutcome> {
  return (await call(harness(response).api, route)).outcome;
}

const FAILED: LicenceOutcome = { kind: 'failed' };

describe('what each licence route sends', () => {
  it('reads the salt with a bearer-only GET', async () => {
    const { api, sent } = harness(reply(200, { fingerprintSalt: 'salt' }));
    await api.fetchLicenceSalt(TOKEN);
    expect(sent).toEqual([{ path: 'licence', method: 'GET', token: TOKEN }]);
  });

  it.each([
    ['activate', 'licenceActivate'],
    ['lease', 'lease'],
    ['cleanup', 'licenceCleanup'],
  ] as const)('sends %s as a bearer POST with the exact body string and the device header', async (route, path) => {
    const { api, sent } = harness(reply(200, {}));
    await call(api, route);
    expect(sent).toEqual([
      { path, method: 'POST', token: TOKEN, rawBody: CALL.body, headers: { 'BFC-Device': CALL.device } },
    ]);
    expect(sent[0]?.body).toBeUndefined();
  });
});

describe('the salt route', () => {
  it('returns the salt', async () => {
    await expect(outcomeOf('salt', reply(200, { premiumActive: true, holder: null, fingerprintSalt: 'c2FsdA' }))).resolves.toEqual({
      kind: 'salt',
      fingerprintSalt: 'c2FsdA',
    });
  });

  it.each([
    ['no salt in the answer', reply(200, { premiumActive: true })],
    ['an empty salt', reply(200, { fingerprintSalt: '' })],
    ['a salt that is not a string', reply(200, { fingerprintSalt: 7 })],
    ['a body that is not JSON', reply(200, 'oops')],
    ['a body that is an array', reply(200, [])],
  ])('is failed with %s', async (_name, response) => {
    await expect(outcomeOf('salt', response)).resolves.toEqual(FAILED);
  });

  it('is unauthorized on a bearer 401', async () => {
    await expect(outcomeOf('salt', reply(401))).resolves.toEqual({ kind: 'unauthorized' });
  });

  it('reads a device_signature 401 as unauthorized too: this route carries no signature', async () => {
    await expect(outcomeOf('salt', reply(401, { reason: 'device_signature' }))).resolves.toEqual({ kind: 'unauthorized' });
  });
});

describe('a Lease answer (activate and renew)', () => {
  it('activation: the envelope, the device id and the unsigned bundle hint', async () => {
    const body = { ...ENVELOPE, deviceId: 'dev-1', bundle: { latestSequence: 7 } };
    await expect(outcomeOf('activate', reply(200, body))).resolves.toEqual({
      kind: 'lease',
      envelope: ENVELOPE,
      deviceId: 'dev-1',
      latestSequence: 7,
    });
  });

  it('activation: a null bundle hint stays null', async () => {
    const body = { ...ENVELOPE, deviceId: 'dev-1', bundle: { latestSequence: null } };
    const out = await outcomeOf('activate', reply(200, body));
    expect(out.kind === 'lease' && out.latestSequence).toBeNull();
  });

  it('renewal: the envelope with no device id', async () => {
    await expect(outcomeOf('lease', reply(200, { ...ENVELOPE, bundle: { latestSequence: null } }))).resolves.toEqual({
      kind: 'lease',
      envelope: ENVELOPE,
      deviceId: null,
      latestSequence: null,
    });
  });

  it('renewal: tolerates a missing bundle and a hint that is not an integer', async () => {
    const missing = await outcomeOf('lease', reply(200, ENVELOPE));
    expect(missing.kind === 'lease' && missing.latestSequence).toBeNull();
    const odd = await outcomeOf('lease', reply(200, { ...ENVELOPE, bundle: { latestSequence: 1.5 } }));
    expect(odd.kind === 'lease' && odd.latestSequence).toBeNull();
  });

  it.each([
    ['activation without a device id', 'activate' as const, { ...ENVELOPE }],
    ['activation with a device id that is not a string', 'activate' as const, { ...ENVELOPE, deviceId: 3 }],
    ['activation without a Lease', 'activate' as const, { sig: 'x', keyId: 'k', deviceId: 'd' }],
    ['renewal without a signature', 'lease' as const, { lease: 'x', keyId: 'k' }],
    ['renewal without a key id', 'lease' as const, { lease: 'x', sig: 'y' }],
    ['renewal with a Lease that is not a string', 'lease' as const, { lease: 1, sig: 'y', keyId: 'k' }],
  ])('is failed for %s', async (_name, route, body) => {
    await expect(outcomeOf(route, reply(200, body))).resolves.toEqual(FAILED);
  });

  it.each(['activate', 'lease'] as const)('is failed on %s when the body is not JSON', async (route) => {
    await expect(outcomeOf(route, reply(200, 'oops'))).resolves.toEqual(FAILED);
  });
});

describe('the cleanup answer', () => {
  it.each(['confirmed', 'lapsed'] as const)('reads %s', async (result) => {
    await expect(outcomeOf('cleanup', reply(200, { cleanup: result }))).resolves.toEqual({ kind: 'cleanup', result });
  });

  it.each([
    ['another word', { cleanup: 'maybe' }],
    ['no field', {}],
    ['a non-string', { cleanup: true }],
  ])('is failed for %s', async (_name, body) => {
    await expect(outcomeOf('cleanup', reply(200, body))).resolves.toEqual(FAILED);
  });
});

/** One row per refusal in the shipped licence-route contract, by route. */
interface Refusal {
  readonly route: Route;
  readonly status: number;
  readonly body: unknown;
  readonly outcome: LicenceOutcome;
}

const ACTIVATE_REFUSALS: readonly Refusal[] = [
  { route: 'activate', status: 400, body: { reason: 'invalid_body' }, outcome: FAILED },
  { route: 'activate', status: 401, body: { reason: 'device_signature' }, outcome: { kind: 'deviceSignature' } },
  { route: 'activate', status: 401, body: '', outcome: { kind: 'unauthorized' } },
  { route: 'activate', status: 403, body: { reason: 'premium_inactive' }, outcome: { kind: 'premiumInactive' } },
  { route: 'activate', status: 403, body: { reason: 'device_foreign' }, outcome: { kind: 'foreign' } },
  {
    route: 'activate',
    status: 409,
    body: { reason: 'held_elsewhere', holderName: 'PC-B', nextMoveAt: '2026-11-20T00:00:00.000Z' },
    outcome: { kind: 'heldElsewhere', holderName: 'PC-B', nextMoveAt: '2026-11-20T00:00:00.000Z' },
  },
  {
    route: 'activate',
    status: 409,
    body: { reason: 'held_elsewhere', holderName: 'PC-B', nextMoveAt: null },
    outcome: { kind: 'heldElsewhere', holderName: 'PC-B', nextMoveAt: null },
  },
  {
    route: 'activate',
    status: 409,
    body: { reason: 'move_limit', lastMoveAt: '2026-10-20T00:00:00.000Z', nextMoveAt: '2026-11-19T00:00:00.000Z' },
    outcome: { kind: 'moveLimit', lastMoveAt: '2026-10-20T00:00:00.000Z', nextMoveAt: '2026-11-19T00:00:00.000Z' },
  },
  { route: 'activate', status: 409, body: { reason: 'device_mismatch' }, outcome: { kind: 'mismatch' } },
  { route: 'activate', status: 429, body: '', outcome: FAILED },
  { route: 'activate', status: 503, body: { reason: 'busy' }, outcome: FAILED },
  { route: 'activate', status: 503, body: { reason: 'licence_unconfigured' }, outcome: FAILED },
  { route: 'activate', status: 502, body: '', outcome: FAILED },
];

const LEASE_REFUSALS: readonly Refusal[] = [
  { route: 'lease', status: 400, body: { reason: 'invalid_body' }, outcome: FAILED },
  { route: 'lease', status: 401, body: { reason: 'device_signature' }, outcome: { kind: 'deviceSignature' } },
  { route: 'lease', status: 401, body: '', outcome: { kind: 'unauthorized' } },
  { route: 'lease', status: 403, body: { reason: 'device_foreign' }, outcome: { kind: 'foreign' } },
  { route: 'lease', status: 409, body: { reason: 'device_mismatch' }, outcome: { kind: 'mismatch' } },
  { route: 'lease', status: 429, body: '', outcome: FAILED },
  { route: 'lease', status: 503, body: { reason: 'busy' }, outcome: FAILED },
  { route: 'lease', status: 503, body: { reason: 'licence_unconfigured' }, outcome: FAILED },
  { route: 'lease', status: 502, body: '', outcome: FAILED },
];

const CLEANUP_REFUSALS: readonly Refusal[] = [
  { route: 'cleanup', status: 400, body: { reason: 'invalid_body' }, outcome: FAILED },
  { route: 'cleanup', status: 401, body: { reason: 'device_signature' }, outcome: { kind: 'deviceSignature' } },
  { route: 'cleanup', status: 401, body: '', outcome: { kind: 'unauthorized' } },
  { route: 'cleanup', status: 403, body: { reason: 'device_foreign' }, outcome: { kind: 'foreign' } },
  { route: 'cleanup', status: 409, body: { reason: 'not_left' }, outcome: { kind: 'notLeft' } },
  { route: 'cleanup', status: 409, body: { reason: 'device_mismatch' }, outcome: { kind: 'mismatch' } },
  { route: 'cleanup', status: 429, body: '', outcome: FAILED },
  { route: 'cleanup', status: 503, body: { reason: 'busy' }, outcome: FAILED },
  { route: 'cleanup', status: 503, body: { reason: 'licence_unconfigured' }, outcome: FAILED },
  { route: 'cleanup', status: 502, body: '', outcome: FAILED },
];

const SALT_REFUSALS: readonly Refusal[] = [
  { route: 'salt', status: 401, body: '', outcome: { kind: 'unauthorized' } },
  { route: 'salt', status: 429, body: '', outcome: FAILED },
  { route: 'salt', status: 503, body: { reason: 'licence_unconfigured' }, outcome: FAILED },
  { route: 'salt', status: 502, body: '', outcome: FAILED },
];

describe('every shipped refusal maps to its outcome', () => {
  const rows = [...SALT_REFUSALS, ...ACTIVATE_REFUSALS, ...LEASE_REFUSALS, ...CLEANUP_REFUSALS];

  it.each(rows.map((r) => [`${r.route} ${String(r.status)} ${JSON.stringify(r.body)}`, r] as const))('%s', async (_name, row) => {
    await expect(outcomeOf(row.route, reply(row.status, row.body))).resolves.toEqual(row.outcome);
  });
});

describe('a refusal the route cannot give, or one that is malformed', () => {
  const rows: ReadonlyArray<readonly [string, Route, PremiumHttpResponse]> = [
    ['an unknown status', 'activate', reply(418, { reason: 'teapot' })],
    ['an unknown 403 reason', 'activate', reply(403, { reason: 'banned' })],
    ['an unknown 409 reason', 'activate', reply(409, { reason: 'busy_bee' })],
    ['a 409 with no reason', 'activate', reply(409, {})],
    ['held_elsewhere without a holder name', 'activate', reply(409, { reason: 'held_elsewhere', nextMoveAt: null })],
    ['move_limit without dates', 'activate', reply(409, { reason: 'move_limit' })],
    ['move_limit with one date', 'activate', reply(409, { reason: 'move_limit', lastMoveAt: 'x' })],
    ['premium_inactive on a renewal', 'lease', reply(403, { reason: 'premium_inactive' })],
    ['held_elsewhere on a renewal', 'lease', reply(409, { reason: 'held_elsewhere', holderName: 'PC-B' })],
    ['not_left on a renewal', 'lease', reply(409, { reason: 'not_left' })],
    ['premium_inactive on a report', 'cleanup', reply(403, { reason: 'premium_inactive' })],
    ['move_limit on a report', 'cleanup', reply(409, { reason: 'move_limit', lastMoveAt: 'a', nextMoveAt: 'b' })],
    ['device_foreign on the salt route', 'salt', reply(403, { reason: 'device_foreign' })],
    ['device_mismatch on the salt route', 'salt', reply(409, { reason: 'device_mismatch' })],
    ['a 404', 'lease', reply(404)],
    ['a 500', 'lease', reply(500)],
  ];

  it.each(rows)('%s is failed', async (_name, route, response) => {
    await expect(outcomeOf(route, response)).resolves.toEqual(FAILED);
  });
});

describe('Retry-After and the server clock', () => {
  it.each([429, 503, 502])('carries Retry-After on a %s', async (status) => {
    await expect(outcomeOf('lease', reply(status, '', { retryAfterSec: 90 }))).resolves.toEqual({
      kind: 'failed',
      retryAfterSec: 90,
    });
  });

  it('leaves retryAfterSec out when none was sent', async () => {
    const out = await outcomeOf('lease', reply(429));
    expect('retryAfterSec' in out).toBe(false);
  });

  it('hands over the Date header of any answer, success, refusal or failure', async () => {
    const dateMs = Date.UTC(2026, 9, 21, 7, 28, 0);
    for (const response of [
      reply(200, { ...ENVELOPE }, { dateMs }),
      reply(401, { reason: 'device_signature' }, { dateMs }),
      reply(503, '', { dateMs }),
    ]) {
      expect((await call(harness(response).api, 'lease')).dateMs).toBe(dateMs);
    }
  });

  it('has no clock when the answer carried none', async () => {
    expect((await call(harness(reply(200, { ...ENVELOPE })).api, 'lease')).dateMs).toBeNull();
  });
});

describe('an unreachable server', () => {
  it.each(['salt', 'activate', 'lease', 'cleanup'] as const)('makes %s failed, with no clock', async (route) => {
    await expect(call(harness(new Error('offline')).api, route)).resolves.toEqual({ outcome: FAILED, dateMs: null });
  });
});

import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({ net: { fetch: vi.fn() } }));

import { INACTIVE_STATUS_BODY, type StubReply } from '../premium-test-support.js';
import {
  COMPUTER_NAME,
  MINUTE,
  USER,
  createLicenceHarness,
  keyIdOf,
  type LicenceHarness,
  present,
} from './licence-test-support.js';

const activations = (h: LicenceHarness) => h.licenceRequests().filter((request) => request.path === 'licenceActivate');
const bodyOf = (request: { body: unknown }) => request.body as { move: boolean; computerName: string };

describe('activation', () => {
  it('sends one activation with move false and no user action once Premium is active', async () => {
    const h = createLicenceHarness();
    h.scriptHolder();

    await h.boot();

    expect(activations(h)).toHaveLength(1);
    expect(bodyOf(present(activations(h)[0])).move).toBe(false);
    expect(h.licence.view().state).toBe('holds');
  });

  it('never activates while status says Premium is not active', async () => {
    const h = createLicenceHarness();
    h.scriptHolder();
    h.premium.stub.on('status', { status: 200, body: INACTIVE_STATUS_BODY });

    await h.boot();
    await h.premium.clock.advance(2 * 60 * MINUTE);

    expect(activations(h)).toEqual([]);
    expect(h.licence.view().state).toBe('inactive');
  });

  it('renews rather than activates once this subject has a device id', async () => {
    const h = createLicenceHarness();
    h.scriptHolder();
    await h.boot();

    await h.restart();
    await h.premium.clock.advance(16 * MINUTE);

    expect(activations(h)).toHaveLength(1);
    expect(h.licenceRequests().filter((request) => request.path === 'lease').length).toBeGreaterThan(1);
  });

  it.each<[string, StubReply, string, Record<string, unknown>]>([
    [
      '409 held_elsewhere',
      { status: 409, body: { reason: 'held_elsewhere', holderName: 'OTHER-PC', nextMoveAt: null } },
      'elsewhere',
      { holderName: 'OTHER-PC' },
    ],
    ['409 device_mismatch', { status: 409, body: { reason: 'device_mismatch' } }, 'mismatch', {}],
    ['403 premium_inactive', { status: 403, body: { reason: 'premium_inactive' } }, 'inactive', {}],
    ['503 busy', { status: 503, body: { reason: 'busy' } }, 'unconfirmed', { reason: 'network' }],
    ['an unreadable answer', { status: 200, body: { nothing: true } }, 'unconfirmed', { reason: 'network' }],
  ])('answers %s with one request and the state %s', async (_name, reply, state, extra) => {
    const h = createLicenceHarness();
    h.scriptHolder();
    h.premium.stub.on('licenceActivate', reply);

    await h.boot();

    expect(activations(h)).toHaveLength(1);
    expect(h.licence.view()).toMatchObject({ state, ...extra });
  });

  it('retries a failed activation on the 1, 2, 5 minute schedule', async () => {
    const h = createLicenceHarness();
    h.scriptHolder();
    const times: number[] = [];
    h.premium.stub.on('licenceActivate', () => {
      times.push(h.premium.clock.now());
      return { status: 503, body: { reason: 'busy' } };
    });

    await h.boot();
    const start = present(times[0]);
    await h.premium.clock.advance(9 * MINUTE);

    expect(times.map((at) => (at - start) / MINUTE)).toEqual([0, 1, 3, 8]);
  });
});

describe('Move', () => {
  async function elsewhere(): Promise<LicenceHarness> {
    const h = createLicenceHarness();
    h.scriptHolder();
    h.premium.stub.on('licenceActivate', (request) =>
      (request.body as { move: boolean }).move
        ? h.activation(request)
        : { status: 409, body: { reason: 'held_elsewhere', holderName: 'OTHER-PC', nextMoveAt: null } },
    );
    await h.boot();
    return h;
  }

  it('sends nothing without a press, however long it waits', async () => {
    const h = await elsewhere();

    await h.premium.clock.advance(3 * 60 * MINUTE);

    expect(activations(h).filter((request) => bodyOf(request).move)).toEqual([]);
    expect(h.licence.view().state).toBe('elsewhere');
  });

  it('a press sends move true with the computer name; two presses send one request', async () => {
    const h = await elsewhere();

    h.licence.pressMove();
    h.licence.pressMove();
    await h.premium.clock.advance(0);

    const moves = activations(h).filter((request) => bodyOf(request).move);
    expect(moves).toHaveLength(1);
    expect(bodyOf(present(moves[0])).computerName).toBe(COMPUTER_NAME);
    expect(h.licence.view()).toMatchObject({ state: 'holds', moveInFlight: false });
  });

  it('shows the move in flight and ignores a second press until the answer lands', async () => {
    const h = await elsewhere();
    let release: (reply: StubReply) => void = () => undefined;
    h.premium.stub.on(
      'licenceActivate',
      () =>
        new Promise<StubReply>((resolve) => {
          release = resolve;
        }),
    );

    h.licence.pressMove();
    await h.premium.clock.advance(0);
    expect(h.licence.view().moveInFlight).toBe(true);
    h.licence.pressMove();
    await h.premium.clock.advance(0);

    expect(h.premium.stub.calls('licenceActivate').filter((request) => bodyOf(request).move)).toHaveLength(1);
    release({ status: 503 });
    await h.premium.clock.advance(0);
    expect(h.licence.view().moveInFlight).toBe(false);
  });

  it('answers move_limit with both dates, the state move_limit, and no automatic retry', async () => {
    const h = await elsewhere();
    h.premium.stub.on('licenceActivate', {
      status: 409,
      body: { reason: 'move_limit', lastMoveAt: '2026-10-10T12:00:00.000Z', nextMoveAt: '2026-11-09T12:00:00.000Z' },
    });

    h.licence.pressMove();
    await h.premium.clock.advance(0);
    const sent = h.premium.stub.calls('licenceActivate').length;
    await h.premium.clock.advance(60 * MINUTE);

    expect(h.licence.view()).toMatchObject({
      state: 'move_limit',
      lastMoveAt: '2026-10-10T12:00:00.000Z',
      nextMoveAt: '2026-11-09T12:00:00.000Z',
    });
    expect(h.premium.stub.calls('licenceActivate')).toHaveLength(sent);
  });

  it('a failed move returns to the state before the press with the failure flag, and does not retry', async () => {
    const h = await elsewhere();
    h.premium.stub.on('licenceActivate', { status: 503, body: { reason: 'busy' } });

    h.licence.pressMove();
    await h.premium.clock.advance(0);
    const sent = h.premium.stub.calls('licenceActivate').length;
    await h.premium.clock.advance(60 * MINUTE);

    expect(h.licence.view()).toMatchObject({
      state: 'elsewhere',
      holderName: 'OTHER-PC',
      moveFailed: true,
      moveInFlight: false,
    });
    expect(h.premium.stub.calls('licenceActivate')).toHaveLength(sent);
  });

  it('recovering from a mismatch moves with a fresh device key', async () => {
    const h = createLicenceHarness();
    h.scriptHolder();
    h.premium.stub.on('licenceActivate', (request) =>
      (request.body as { move: boolean }).move
        ? h.activation(request)
        : { status: 409, body: { reason: 'device_mismatch' } },
    );
    await h.boot();
    const before = present(h.store.readDevice(USER)).keyId;

    h.licence.pressMove();
    await h.premium.clock.advance(0);

    const move = present(activations(h).find((request) => bodyOf(request).move));
    expect(keyIdOf(move)).not.toBe(before);
    expect(h.store.clearedDevices).toContain(USER);
    expect(h.licence.view().state).toBe('holds');
  });
});

import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({ net: { fetch: vi.fn() } }));

import { ACTIVE_STATUS_BODY, SECRETS, ME_BODY, createFakeVault, createHarness, session, settle } from './premium-test-support.js';

function signedInHarness(meBody: unknown) {
  const h = createHarness({ vault: createFakeVault(session(SECRETS.token)) });
  h.stub.on('me', { status: 200, body: meBody });
  h.stub.on('status', { status: 200, body: ACTIVE_STATUS_BODY });
  return h;
}

describe('the service getters a bundle reads', () => {
  it('answers null before any answer and the held status after one', async () => {
    const h = signedInHarness({ ...ME_BODY, audience: 'tester' });
    expect(h.service.statusSnapshot()).toBeNull();
    expect(h.service.audience()).toBeNull();

    h.service.start();
    await settle();

    expect(h.service.statusSnapshot()).toEqual({ active: true, until: '2026-12-01T00:00:00.000Z' });
    expect(h.service.audience()).toBe('tester');
  });

  it('reads any audience but the three known ones as unknown', async () => {
    const h = signedInHarness({ ...ME_BODY, audience: 'admin' });

    h.service.start();
    await settle();

    expect(h.service.audience()).toBeNull();
  });

  it('forgets the audience when the session ends', async () => {
    const h = signedInHarness({ ...ME_BODY, audience: 'owner' });
    h.service.start();
    await settle();
    expect(h.service.audience()).toBe('owner');

    await h.service.signOut();

    expect(h.service.audience()).toBeNull();
  });

  it('never puts the audience in an emitted view', async () => {
    const h = signedInHarness({ ...ME_BODY, audience: 'tester' });

    h.service.start();
    await settle();

    const emitted = JSON.stringify([...h.views, h.service.getView()]);
    expect(emitted).not.toContain('audience');
    expect(emitted).not.toContain('tester');
  });
});

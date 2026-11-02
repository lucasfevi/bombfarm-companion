import { describe, expect, it, vi } from 'vitest';
import { signedOutPremiumView, type IpcInvokeChannel, type PremiumView } from '@bombfarm/contracts';
import { accept, createPremiumStore, initialPremiumState, type PremiumBridge } from './premium-store';

const signedIn: PremiumView = { ...signedOutPremiumView, session: 'signed-in', visible: true };
const signingIn: PremiumView = { ...signedOutPremiumView, session: 'signing-in' };

function fakeBridge(replies: Partial<Record<IpcInvokeChannel, unknown>> = {}) {
  let handler: ((view: PremiumView) => void) | null = null;
  const unsubscribe = vi.fn(() => {
    handler = null;
  });
  const invoke = vi.fn((channel: IpcInvokeChannel) => Promise.resolve(replies[channel]));
  const bridge = {
    invoke,
    on: (_channel: 'premium:changed', next: (view: PremiumView) => void) => {
      handler = next;
      return unsubscribe;
    },
  } as unknown as PremiumBridge;
  return { bridge, invoke, unsubscribe, push: (view: PremiumView) => handler?.(view) };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('the premium store reducer', () => {
  it('takes a push', () => {
    expect(accept(initialPremiumState, { kind: 'pushed', view: signedIn }).view).toBe(signedIn);
  });

  it('discards a mount read that a push overtook', () => {
    const pushed = accept(initialPremiumState, { kind: 'pushed', view: signingIn });

    expect(accept(pushed, { kind: 'fetched', view: signedIn, issuedAt: initialPremiumState.applied })).toBe(pushed);
  });

  it('takes a mount read nothing overtook', () => {
    expect(accept(initialPremiumState, { kind: 'fetched', view: signedIn, issuedAt: 0 }).view).toBe(signedIn);
  });
});

describe('the premium store', () => {
  it('starts signed out and reads the current view once on start', async () => {
    const { bridge, invoke } = fakeBridge({ 'premium:get': signedIn });
    const store = createPremiumStore(() => bridge);

    expect(store.getState().view).toBe(signedOutPremiumView);
    store.start();
    store.start();
    await flush();

    expect(invoke.mock.calls.filter(([channel]) => channel === 'premium:get')).toHaveLength(1);
    expect(store.getState().view).toBe(signedIn);
  });

  it('follows the changed event and tells its subscribers', async () => {
    const { bridge, push } = fakeBridge({ 'premium:get': signedOutPremiumView });
    const store = createPremiumStore(() => bridge);
    const seen: PremiumView[] = [];
    store.subscribe((state) => seen.push(state.view));
    store.start();
    await flush();

    push(signingIn);

    expect(store.getState().view).toBe(signingIn);
    expect(seen.at(-1)).toBe(signingIn);
  });

  it('stops telling a subscriber once it has unsubscribed', async () => {
    const { bridge, push } = fakeBridge({ 'premium:get': signedOutPremiumView });
    const store = createPremiumStore(() => bridge);
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    store.start();
    await flush();
    listener.mockClear();

    unsubscribe();
    push(signedIn);

    expect(listener).not.toHaveBeenCalled();
    expect(store.getState().view).toBe(signedIn);
  });

  it.each([
    ['signIn', 'premium:signIn', { ok: true }],
    ['refresh', 'premium:refresh', { ok: false, reason: 'too-soon' }],
    ['manage', 'premium:manage', { ok: true }],
  ] as const)('%s invokes its channel once and returns the answer', async (action, channel, reply) => {
    const { bridge, invoke } = fakeBridge({ [channel]: reply });
    const store = createPremiumStore(() => bridge);

    expect(await store.actions[action]()).toEqual(reply);

    expect(invoke.mock.calls.filter(([called]) => called === channel)).toHaveLength(1);
  });

  it('cancels a sign-in through its channel once', async () => {
    const { bridge, invoke } = fakeBridge({ 'premium:cancelSignIn': true });
    const store = createPremiumStore(() => bridge);

    expect(await store.actions.cancelSignIn()).toBe(true);

    expect(invoke.mock.calls.filter(([called]) => called === 'premium:cancelSignIn')).toHaveLength(1);
  });

  it('signs out through its channel once and takes the view it answers with', async () => {
    const { bridge, invoke } = fakeBridge({ 'premium:signOut': signedOutPremiumView });
    const store = createPremiumStore(() => bridge);
    store.start();

    await store.actions.signOut();

    expect(invoke.mock.calls.filter(([called]) => called === 'premium:signOut')).toHaveLength(1);
    expect(store.getState().view).toBe(signedOutPremiumView);
  });

  it('answers unavailable when a channel call throws', async () => {
    const invoke = vi.fn(() => Promise.reject(new Error('no handler')));
    const store = createPremiumStore(() => ({ invoke, on: () => () => undefined }));

    expect(await store.actions.refresh()).toEqual({ ok: false, reason: 'unavailable' });
  });

  it('answers unavailable and stays signed out without a bridge', async () => {
    const store = createPremiumStore(() => undefined);
    store.start();

    expect(await store.actions.signIn()).toEqual({ ok: false, reason: 'unavailable' });
    expect(await store.actions.cancelSignIn()).toBe(false);
    expect(store.getState().view).toBe(signedOutPremiumView);
  });
});

describe('the premium store — use Premium on this PC', () => {
  it('sends one premium:useHere for a double press and shares its answer', async () => {
    let answer: (value: unknown) => void = () => {};
    const { bridge, invoke } = fakeBridge();
    invoke.mockImplementation(
      () =>
        new Promise((resolve) => {
          answer = resolve;
        }),
    );
    const store = createPremiumStore(() => bridge);

    const first = store.actions.moveHere();
    const second = store.actions.moveHere();
    answer({ ok: true });

    expect(await first).toEqual({ ok: true });
    expect(await second).toEqual({ ok: true });
    expect(invoke.mock.calls.filter(([channel]) => channel === 'premium:useHere')).toHaveLength(1);
  });

  it('sends again once the first press was answered', async () => {
    const { bridge, invoke } = fakeBridge({ 'premium:useHere': { ok: true } });
    const store = createPremiumStore(() => bridge);

    await store.actions.moveHere();
    await store.actions.moveHere();

    expect(invoke.mock.calls.filter(([channel]) => channel === 'premium:useHere')).toHaveLength(2);
  });

  it('answers unavailable without a bridge', async () => {
    const store = createPremiumStore(() => undefined);

    expect(await store.actions.moveHere()).toEqual({ ok: false, reason: 'unavailable' });
  });
});

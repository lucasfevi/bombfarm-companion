import { PREMIUM_REFRESH_FLOOR_MS, type PremiumView } from '@bombfarm/contracts';
import { describe, expect, it } from 'vitest';
import { SECRETS, createHarness, settle, type Harness } from './premium-test-support.js';

type State = PremiumView['session'];
type EventName =
  | 'signIn'
  | 'cancelSignIn'
  | 'callbackAccepted'
  | 'callbackDeclined'
  | 'timeout'
  | 'exchangeRefused'
  | 'unauthorized';

const STATES: State[] = ['signed-out', 'signing-in', 'signed-in'];
const EVENTS: EventName[] = [
  'signIn',
  'cancelSignIn',
  'callbackAccepted',
  'callbackDeclined',
  'timeout',
  'exchangeRefused',
  'unauthorized',
];

/** The only transitions the session may make. Every pair not listed here must leave the session where it is. */
const TABLE: Partial<Record<`${State}|${EventName}`, State>> = {
  'signed-out|signIn': 'signing-in',
  'signing-in|callbackAccepted': 'signed-in',
  'signing-in|cancelSignIn': 'signed-out',
  'signing-in|callbackDeclined': 'signed-out',
  'signing-in|timeout': 'signed-out',
  'signing-in|exchangeRefused': 'signed-out',
  'signed-in|unauthorized': 'signed-out',
};

async function arrive(state: State): Promise<Harness> {
  const h = createHarness();
  if (state === 'signing-in') await h.service.signIn();
  if (state === 'signed-in') await h.signedIn();
  expect(h.service.getView().session).toBe(state);
  return h;
}

async function apply(h: Harness, event: EventName): Promise<void> {
  const listener = h.listeners.made.at(-1);
  switch (event) {
    case 'signIn':
      await h.service.signIn();
      break;
    case 'cancelSignIn':
      h.service.cancelSignIn();
      break;
    case 'callbackAccepted':
      listener?.finish({ kind: 'code', code: SECRETS.code });
      break;
    case 'callbackDeclined':
      listener?.finish({ kind: 'declined' });
      break;
    case 'timeout':
      listener?.finish({ kind: 'timed-out' });
      break;
    case 'exchangeRefused':
      h.stub.on('token', { status: 400 });
      listener?.finish({ kind: 'code', code: SECRETS.code });
      break;
    case 'unauthorized':
      h.stub.on('status', { status: 401 });
      await h.clock.advance(PREMIUM_REFRESH_FLOOR_MS);
      await h.service.refresh('button');
      break;
  }
  await settle();
}

describe('the session state machine', () => {
  const pairs = STATES.flatMap((state) => EVENTS.map((event) => [state, event] as const));

  it.each(pairs)('from %s on %s moves only as the table says', async (state, event) => {
    const h = await arrive(state);

    await apply(h, event);

    expect(h.service.getView().session).toBe(TABLE[`${state}|${event}`] ?? state);
  });

  it('answers a sign-in while signed in or signing in with the matching refusal and no transition', async () => {
    const signedIn = await arrive('signed-in');
    expect(await signedIn.service.signIn()).toEqual({ ok: false, reason: 'already-signed-in' });

    const signingIn = await arrive('signing-in');
    expect(await signingIn.service.signIn()).toEqual({ ok: false, reason: 'already-signing-in' });
  });
});

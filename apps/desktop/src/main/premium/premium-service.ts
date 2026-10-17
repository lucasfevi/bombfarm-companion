import {
  PREMIUM_SIGN_IN_TIMEOUT_MS,
  signedOutPremiumView,
  type PremiumActionResult,
  type PremiumSignInEnd,
  type PremiumView,
} from '@bombfarm/contracts';
import type { LogPort } from '../storage/index.js';
import type { LoopbackListener, startLoopbackListener } from './loopback-listener.js';
import type { PremiumApi } from './premium-api.js';
import type { createPkce, createState } from './pkce.js';
import type { StoredSession, TokenVault } from './token-vault.js';

export interface PremiumServiceDeps {
  api: PremiumApi;
  vault: TokenVault;
  openExternal(url: string): Promise<void>;
  startListener: typeof startLoopbackListener;
  pkce: { createPkce: typeof createPkce; createState: typeof createState };
  now(): number;
  scheduler?: { readonly setTimeout: typeof setTimeout; readonly clearTimeout: typeof clearTimeout };
  log: LogPort;
  onChanged(view: PremiumView): void;
}

export interface PremiumService {
  start(): void;
  stop(): void;
  getView(): PremiumView;
  signIn(): Promise<PremiumActionResult>;
  cancelSignIn(): boolean;
}

type Session = PremiumView['session'];

function isHttps(url: string): boolean {
  try {
    return new URL(url).protocol === 'https:';
  } catch {
    return false;
  }
}

export function createPremiumService(deps: PremiumServiceDeps): PremiumService {
  let session: Session = 'signed-out';
  let generation = 0;
  let stopped = true;
  let remembered = true;
  let lastSignInEnd: PremiumSignInEnd | null = null;
  let ended: 'expired' | null = null;

  let listener: LoopbackListener | null = null;
  let lastPublished = '';

  function buildView(): PremiumView {
    return { ...signedOutPremiumView, session, rememberedAcrossRestarts: remembered, lastSignInEnd, ended };
  }

  function publish(): void {
    if (stopped) return;
    const view = buildView();
    const serialised = JSON.stringify(view);
    if (serialised === lastPublished) return;
    lastPublished = serialised;
    deps.onChanged(view);
  }

  function attemptIsCurrent(startedIn: number): boolean {
    return startedIn === generation && session === 'signing-in';
  }

  function endAttempt(startedIn: number, reason: PremiumSignInEnd): void {
    if (!attemptIsCurrent(startedIn)) return;
    const open = listener;
    listener = null;
    open?.close();
    generation += 1;
    session = 'signed-out';
    lastSignInEnd = reason;
    deps.log.info({ scope: 'premium', event: 'signin.ended', reason });
    publish();
  }

  function completeSignIn(startedIn: number, granted: StoredSession): void {
    if (!attemptIsCurrent(startedIn)) return;
    listener = null;
    remembered = deps.vault.store(granted) === 'persisted';
    generation += 1;
    session = 'signed-in';
    lastSignInEnd = null;
    ended = null;
    deps.log.info({ scope: 'premium', event: 'signin.ended', reason: 'completed' });
    publish();
  }

  async function awaitCallback(
    startedIn: number,
    active: LoopbackListener,
    verifier: string,
    redirectUri: string,
  ): Promise<void> {
    const outcome = await active.result;
    if (!attemptIsCurrent(startedIn)) return;
    if (outcome.kind === 'declined' || outcome.kind === 'timed-out' || outcome.kind === 'closed') {
      endAttempt(startedIn, outcome.kind === 'closed' ? 'cancelled' : outcome.kind);
      return;
    }
    const exchanged = await deps.api.exchangeCode({ code: outcome.code, verifier, redirectUri });
    if (!attemptIsCurrent(startedIn)) return;
    if (exchanged.ok) completeSignIn(startedIn, exchanged.session);
    else endAttempt(startedIn, exchanged.reason);
  }

  async function signIn(): Promise<PremiumActionResult> {
    if (session === 'signed-in') return { ok: false, reason: 'already-signed-in' };
    if (session === 'signing-in') return { ok: false, reason: 'already-signing-in' };
    session = 'signing-in';
    lastSignInEnd = null;
    ended = null;
    const startedIn = generation;
    deps.log.info({ scope: 'premium', event: 'signin.started' });
    publish();

    const { verifier, challenge } = deps.pkce.createPkce();
    const state = deps.pkce.createState();

    let active: LoopbackListener;
    try {
      active = await deps.startListener({ expectedState: state, timeoutMs: PREMIUM_SIGN_IN_TIMEOUT_MS });
    } catch {
      endAttempt(startedIn, 'port-unavailable');
      return { ok: false, reason: 'failed' };
    }
    if (!attemptIsCurrent(startedIn)) {
      active.close();
      return { ok: false, reason: 'failed' };
    }
    listener = active;

    const requested = await deps.api.requestSignIn({ challenge, state, redirectUri: active.redirectUri });
    if (!attemptIsCurrent(startedIn)) return { ok: false, reason: 'failed' };
    if (!requested.ok) {
      endAttempt(startedIn, requested.reason);
      return { ok: false, reason: 'failed' };
    }
    if (!isHttps(requested.approvalUrl)) {
      endAttempt(startedIn, 'bad-response');
      return { ok: false, reason: 'failed' };
    }

    try {
      await deps.openExternal(requested.approvalUrl);
    } catch {
      endAttempt(startedIn, 'browser-unavailable');
      return { ok: false, reason: 'failed' };
    }
    if (!attemptIsCurrent(startedIn)) return { ok: false, reason: 'failed' };

    void awaitCallback(startedIn, active, verifier, active.redirectUri);
    return { ok: true };
  }

  return {
    start() {
      if (!stopped) return;
      stopped = false;
      if (deps.vault.load() !== null) session = 'signed-in';
      publish();
    },

    stop() {
      stopped = true;
      generation += 1;
      const open = listener;
      listener = null;
      open?.close();
      if (session === 'signing-in') session = 'signed-out';
    },

    getView: buildView,

    signIn,

    cancelSignIn() {
      if (session !== 'signing-in') return false;
      endAttempt(generation, 'cancelled');
      return true;
    },
  };
}

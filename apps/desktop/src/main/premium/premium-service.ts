import {
  isSteamId64,
  PREMIUM_REFRESH_EVERY_MS,
  PREMIUM_REFRESH_FLOOR_MS,
  PREMIUM_SIGN_IN_TIMEOUT_MS,
  type PremiumActionResult,
  type PremiumMe,
  type PremiumReportOutcome,
  type PremiumSignInEnd,
  type PremiumStatus,
  type PremiumView,
} from '@bombfarm/contracts';
import type { LogPort } from '../storage/index.js';
import type { LoopbackListener, startLoopbackListener } from './loopback-listener.js';
import type { FetchResult, PremiumApi } from './premium-api.js';
import type { PremiumCache } from './premium-cache.js';
import type { createPkce, createState } from './pkce.js';
import type { StoredSession, TokenVault } from './token-vault.js';

const BACKOFF_DEFAULT_MS = 600_000;
const BACKOFF_CAP_MS = 3_600_000;

export interface GameIdentity {
  readonly accountId: string;
  readonly steamId64: string | null;
}

export interface PremiumServiceDeps {
  api: PremiumApi;
  vault: TokenVault;
  cache: PremiumCache;
  openExternal(url: string): Promise<void>;
  readGameIdentity(): GameIdentity | null;
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
  signOut(): Promise<PremiumView>;
  refresh(reason: 'open' | 'button'): Promise<PremiumActionResult>;
  manage(): Promise<PremiumActionResult>;
  noteAccountChanged(): void;
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
  const setTimeoutFn = deps.scheduler?.setTimeout ?? setTimeout;
  const clearTimeoutFn = deps.scheduler?.clearTimeout ?? clearTimeout;

  let session: Session = 'signed-out';
  let generation = 0;
  let stopped = true;
  let halted = false;
  let token: StoredSession | null = null;
  let remembered = true;
  let lastSignInEnd: PremiumSignInEnd | null = null;
  let ended: 'expired' | null = null;
  let visibleFlag: boolean | null = null;
  let me: PremiumMe | null = null;
  let status: PremiumStatus | null = null;
  let fetchedAt: string | null = null;
  let lastRefreshFailed = false;
  let report: PremiumReportOutcome | null = null;
  let reportedAccountId: string | null = null;
  let reportedPair: string | null = null;
  let reportingPair: string | null = null;

  let listener: LoopbackListener | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let inFlight: { generation: number; promise: Promise<void> } | null = null;
  let rotating: Promise<void> | null = null;
  let lastFinishedAt: number | null = null;
  let blockedUntil = 0;
  let lastPublished = '';

  function buildView(): PremiumView {
    return {
      session,
      rememberedAcrossRestarts: remembered,
      lastSignInEnd,
      ended,
      visible: visibleFlag === true || me?.admitted === true || status?.active === true,
      me,
      status,
      fetchedAt,
      lastRefreshFailed,
      report,
      reportedAccountId,
    };
  }

  function publish(): void {
    if (stopped) return;
    const view = buildView();
    const serialised = JSON.stringify(view);
    if (serialised === lastPublished) return;
    lastPublished = serialised;
    deps.onChanged(view);
  }

  function isoNow(): string {
    return new Date(deps.now()).toISOString();
  }

  function clearTimer(): void {
    if (timer !== null) clearTimeoutFn(timer);
    timer = null;
  }

  function nextDelayMs(): number {
    const wait = blockedUntil - deps.now();
    return wait > 0 ? wait : PREMIUM_REFRESH_EVERY_MS;
  }

  function armTimer(): void {
    clearTimer();
    if (stopped) return;
    timer = setTimeoutFn(() => {
      timer = null;
      void runFetch();
    }, nextDelayMs());
  }

  function forgetSession(): void {
    token = null;
    me = null;
    status = null;
    fetchedAt = null;
    lastRefreshFailed = false;
    report = null;
    reportedAccountId = null;
    reportedPair = null;
    reportingPair = null;
    remembered = true;
    deps.vault.clear();
    deps.cache.clear();
  }

  function leaveSession(next: { ended: 'expired' | null }): void {
    generation += 1;
    session = 'signed-out';
    ended = next.ended;
    forgetSession();
    armTimer();
    publish();
  }

  function handleUnauthorized(startedIn: number): void {
    if (startedIn !== generation || session !== 'signed-in') return;
    leaveSession({ ended: 'expired' });
  }

  function endAttempt(startedIn: number, reason: PremiumSignInEnd): void {
    if (startedIn !== generation || session !== 'signing-in') return;
    const open = listener;
    listener = null;
    open?.close();
    generation += 1;
    session = 'signed-out';
    lastSignInEnd = reason;
    deps.log.info({ scope: 'premium', event: 'signin.ended', reason });
    publish();
  }

  function attemptIsCurrent(startedIn: number): boolean {
    return startedIn === generation && session === 'signing-in';
  }

  async function rotate(startedIn: number): Promise<void> {
    const held = token;
    if (held === null) return;
    const result = await deps.api.rotate(held.token);
    if (startedIn !== generation) return;
    if (result.ok) {
      remembered = deps.vault.store(result.session) === 'persisted';
      token = result.session;
      publish();
    } else if (result.reason === 'unauthorized') {
      handleUnauthorized(startedIn);
    }
  }

  function stillSignedIn(startedIn: number): boolean {
    return startedIn === generation && session === 'signed-in';
  }

  async function bearer(startedIn: number): Promise<string | null> {
    const held = token;
    if (held === null || !stillSignedIn(startedIn)) return null;
    const due = Date.parse(held.rotateAfter);
    if (!Number.isNaN(due) && deps.now() >= due) {
      rotating ??= rotate(startedIn).finally(() => {
        rotating = null;
      });
      await rotating;
    }
    return stillSignedIn(startedIn) && token !== null ? token.token : null;
  }

  function noteFailure(result: { ok: false; reason: string; retryAfterSec?: number }): void {
    if (result.reason === 'bad-response') {
      deps.log.warn({ scope: 'premium', event: 'status.unreadable' });
      return;
    }
    if (result.reason === 'rate-limited') {
      const waitMs = result.retryAfterSec === undefined ? BACKOFF_DEFAULT_MS : result.retryAfterSec * 1000;
      blockedUntil = deps.now() + Math.min(waitMs, BACKOFF_CAP_MS);
      deps.log.warn({ scope: 'premium', event: 'status.refresh_failed', status: 429 });
      return;
    }
    deps.log.warn({ scope: 'premium', event: 'status.refresh_failed', status: 'unreachable' });
  }

  async function withBearer<T>(
    startedIn: number,
    call: (bearerToken: string) => Promise<FetchResult<T>>,
  ): Promise<FetchResult<T> | null> {
    const bearerToken = await bearer(startedIn);
    if (bearerToken === null) return null;
    const result = await call(bearerToken);
    if (!result.ok && result.reason === 'unauthorized') handleUnauthorized(startedIn);
    return result;
  }

  async function doFetch(startedIn: number): Promise<void> {
    const visibilityRequest = deps.api.fetchVisibility();
    const signedIn = session === 'signed-in';
    const [visibility, statusResult, meResult] = await Promise.all([
      visibilityRequest,
      signedIn ? withBearer(startedIn, (bearerToken) => deps.api.fetchStatus(bearerToken)) : null,
      signedIn ? withBearer(startedIn, (bearerToken) => deps.api.fetchMe(bearerToken)) : null,
    ]);
    if (startedIn !== generation) return;

    let learned = false;
    if (visibility.ok) {
      visibleFlag = visibility.visible;
      learned = true;
    } else {
      noteFailure(visibility);
    }

    if (statusResult !== null && meResult !== null) {
      if (statusResult.ok) {
        status = statusResult.value;
        fetchedAt = isoNow();
        learned = true;
      } else {
        noteFailure(statusResult);
      }
      if (meResult.ok) {
        me = meResult.value;
        learned = true;
      } else {
        noteFailure(meResult);
      }
      lastRefreshFailed = !statusResult.ok || !meResult.ok;
    }

    if (learned) deps.cache.write({ fetchedAt: fetchedAt ?? isoNow(), status, me, visible: visibleFlag });
    publish();
  }

  function runFetch(): Promise<void> {
    if (inFlight !== null && inFlight.generation === generation) return inFlight.promise;
    const startedIn = generation;
    const entry: { generation: number; promise: Promise<void> } = {
      generation: startedIn,
      promise: Promise.resolve(),
    };
    entry.promise = doFetch(startedIn)
      .catch(() => {
        deps.log.warn({ scope: 'premium', event: 'status.refresh_failed', status: 'unreachable' });
      })
      .finally(() => {
        if (inFlight === entry) inFlight = null;
        if (startedIn !== generation) return;
        lastFinishedAt = deps.now();
        armTimer();
      });
    inFlight = entry;
    return entry.promise;
  }

  function fetchNow(): void {
    if (deps.now() < blockedUntil) {
      armTimer();
      return;
    }
    void runFetch();
  }

  async function reportAccount(): Promise<void> {
    if (halted || session !== 'signed-in') return;
    const startedIn = generation;
    const identity = deps.readGameIdentity();
    if (identity === null) {
      report = { kind: 'not-sent', reason: 'no-game-account' };
      reportedAccountId = null;
      publish();
      return;
    }
    const { accountId, steamId64 } = identity;
    if (steamId64 === null || !isSteamId64(steamId64)) {
      report = { kind: 'not-sent', reason: 'no-steam-id' };
      reportedAccountId = null;
      publish();
      return;
    }
    const pair = JSON.stringify([accountId, steamId64]);
    if (pair === reportedPair) {
      report = { kind: 'linked' };
      reportedAccountId = accountId;
      publish();
      return;
    }
    if (pair === reportingPair) return;
    reportingPair = pair;
    try {
      const bearerToken = await bearer(startedIn);
      if (bearerToken === null) return;
      const outcome = await deps.api.reportGameAccount(bearerToken, { accountId, steamId64 });
      if (startedIn !== generation) return;
      if (outcome.kind === 'unauthorized') {
        handleUnauthorized(startedIn);
        return;
      }
      report = outcome;
      reportedAccountId = accountId;
      if (outcome.kind === 'linked') reportedPair = pair;
      deps.log.info({
        scope: 'premium',
        event: 'report.outcome',
        outcome: outcome.kind,
        ...(outcome.kind === 'refused' ? { reason: outcome.reason } : {}),
      });
      publish();
    } finally {
      if (reportingPair === pair) reportingPair = null;
    }
  }

  function completeSignIn(startedIn: number, granted: StoredSession): void {
    if (!attemptIsCurrent(startedIn)) return;
    listener = null;
    remembered = deps.vault.store(granted) === 'persisted';
    token = granted;
    generation += 1;
    session = 'signed-in';
    lastSignInEnd = null;
    ended = null;
    deps.log.info({ scope: 'premium', event: 'signin.ended', reason: 'completed' });
    publish();
    fetchNow();
    void reportAccount();
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

  async function signOut(): Promise<PremiumView> {
    if (session === 'signing-in') endAttempt(generation, 'cancelled');
    const held = token;
    if (session === 'signed-in' && held !== null) {
      const sent = deps.api.signOut(held.token);
      leaveSession({ ended: null });
      try {
        await sent;
      } catch {
        deps.log.warn({ scope: 'premium', event: 'signout.unreachable' });
      }
    }
    return buildView();
  }

  async function manage(): Promise<PremiumActionResult> {
    if (halted) return { ok: false, reason: 'unavailable' };
    if (session !== 'signed-in') return { ok: false, reason: 'signed-out' };
    const startedIn = generation;
    const bearerToken = await bearer(startedIn);
    if (bearerToken === null) return { ok: false, reason: 'signed-out' };
    const handOff = await deps.api.requestHandOff(bearerToken);
    if (!stillSignedIn(startedIn)) return { ok: false, reason: 'signed-out' };
    if (!handOff.ok && handOff.reason === 'unauthorized') {
      handleUnauthorized(startedIn);
      return { ok: false, reason: 'signed-out' };
    }
    if (!handOff.ok || !isHttps(handOff.url)) {
      deps.log.warn({ scope: 'premium', event: 'handoff.failed', reason: handOff.ok ? 'bad-response' : handOff.reason });
      return { ok: false, reason: 'failed' };
    }
    try {
      await deps.openExternal(handOff.url);
    } catch {
      deps.log.warn({ scope: 'premium', event: 'handoff.failed', reason: 'browser-unavailable' });
      return { ok: false, reason: 'failed' };
    }
    return { ok: true };
  }

  return {
    start() {
      if (!stopped) return;
      stopped = false;
      halted = false;
      const stored = deps.vault.load();
      const cached = deps.cache.read();
      if (cached !== null) visibleFlag = cached.visible;
      if (stored !== null) {
        token = stored;
        session = 'signed-in';
        remembered = true;
        if (cached !== null) {
          status = cached.status;
          me = cached.me;
          fetchedAt = cached.status === null ? null : cached.fetchedAt;
        }
      }
      publish();
      void runFetch();
      void reportAccount();
    },

    stop() {
      stopped = true;
      halted = true;
      generation += 1;
      const open = listener;
      listener = null;
      open?.close();
      clearTimer();
      if (session === 'signing-in') session = 'signed-out';
    },

    getView: buildView,

    signIn,

    signOut,

    manage,

    cancelSignIn() {
      if (session !== 'signing-in') return false;
      endAttempt(generation, 'cancelled');
      return true;
    },

    refresh() {
      if (halted) return Promise.resolve({ ok: false, reason: 'unavailable' });
      if (inFlight !== null && inFlight.generation === generation) {
        return inFlight.promise.then((): PremiumActionResult => ({ ok: true }));
      }
      const now = deps.now();
      if (now < blockedUntil) return Promise.resolve({ ok: false, reason: 'too-soon' });
      if (lastFinishedAt !== null && now - lastFinishedAt < PREMIUM_REFRESH_FLOOR_MS) {
        return Promise.resolve({ ok: false, reason: 'too-soon' });
      }
      return runFetch().then((): PremiumActionResult => ({ ok: true }));
    },

    noteAccountChanged() {
      void reportAccount();
    },
  };
}

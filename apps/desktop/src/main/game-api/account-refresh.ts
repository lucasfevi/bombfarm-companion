import type { AccountSection, AccountView } from '@bombfarm/contracts';
import type {
  ConsentRecord,
  GrantedConsent,
  HttpTransport,
  PacingGate,
  SectionOutcome,
  SessionToken,
} from '@bombfarm/game-api';
import { ROUTES, assembleAccountPayload, grantSession, isGranted, readSection } from '@bombfarm/game-api';
import type { AccountCommitter } from '../game-reader/game-reader-service.js';
import type { LogPort } from '../storage/index.js';
import type { ConsentStore } from './consent-store.js';
import { readSessionToken, type SessionTokenFileResult } from './session-token-file.js';

/**
 * The cycle (LAR-01 enforcement half, LAR-03…05, LAR-11, LAR-15 carry-over half). Ties the pure
 * `packages/game-api` pieces to F3's `AccountStore.commit()` — the only carry-over seam in the
 * product (`R-1`).
 *
 * Per cycle: read consent → not `granted`? commit an all-`missing` payload and issue nothing →
 * else read the token (cached against `mtimeMs`) → `grantSession` → read the five routes through
 * the pacing gate, in `ROUTES` order → `assembleAccountPayload` → `store.commit(...)`.
 */

const SECTIONS: readonly AccountSection[] = ['account', 'heroes', 'skills', 'casa', 'items'];

function allSectionsFailed(reason: 'not_consented' | 'token_unavailable'): Record<AccountSection, SectionOutcome> {
  const result = {} as Record<AccountSection, SectionOutcome>;
  for (const section of SECTIONS) {
    result[section] = { kind: 'failed', reason };
  }
  return result;
}

/** Wraps a transport so an aborted signal rejects the in-flight call immediately — the account
 *  path's own abort wiring, independent of whatever `https-transport.ts` itself does with the
 *  signal at the socket level. */
function wrapAbortable(transport: HttpTransport, signal: AbortSignal): HttpTransport {
  return (req) => {
    if (signal.aborted) {
      return Promise.reject(new Error('aborted'));
    }
    return new Promise((resolve, reject) => {
      const onAbort = (): void => {
        reject(new Error('aborted'));
      };
      signal.addEventListener('abort', onAbort, { once: true });
      transport(req).then(
        (res) => {
          signal.removeEventListener('abort', onAbort);
          resolve(res);
        },
        (err: unknown) => {
          signal.removeEventListener('abort', onAbort);
          reject(err instanceof Error ? err : new Error(String(err)));
        },
      );
    });
  };
}

export interface AccountRefreshDeps {
  consentStore: ConsentStore;
  transport: HttpTransport;
  gate: PacingGate;
  store: AccountCommitter;
  log: LogPort;
  /** Injected clock — the ISO timestamp stamped on every resolved/degraded section this cycle. */
  now(): string;
  /** Injected so tests never touch the real filesystem. Defaults to the real gated read. */
  readToken?: (consent: GrantedConsent) => SessionTokenFileResult;
  /** Injected wall-clock scheduling seam. Defaults to the real timers. */
  scheduler?: { readonly setTimeout: typeof setTimeout; readonly clearTimeout: typeof clearTimeout };
  /** Fallback delay (ms) used to re-check a halted gate. Never what clears `halted` — only
   *  `resetAuth()` does that (a changed token file or an explicit retry); this only paces how
   *  often the refused attempt is retried. */
  haltedRecheckMs?: number;
  /** Called after every commit (T9's `account:changed` IPC event source). Optional so every
   *  existing test/caller that does not care about push notifications is unaffected. */
  onView?: (view: AccountView) => void;
}

export interface AccountRefreshHandle {
  start(): void;
  stop(): void;
  refreshNow(): Promise<AccountView | null>;
  onConsentChanged(record: ConsentRecord): void;
  /** The most recently committed view, or `null` before any cycle has run. */
  getLastView(): AccountView | null;
}

interface CachedToken {
  readonly accountId: string;
  readonly token: SessionToken;
  readonly mtimeMs: number;
}

export function createAccountRefresh(deps: AccountRefreshDeps): AccountRefreshHandle {
  const readToken = deps.readToken ?? readSessionToken;
  const setTimeoutFn = deps.scheduler?.setTimeout ?? setTimeout;
  const clearTimeoutFn = deps.scheduler?.clearTimeout ?? clearTimeout;
  const haltedRecheckMs = deps.haltedRecheckMs ?? 10_000;

  let stopped = true;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let running = false;
  let cachedToken: CachedToken | null = null;
  let currentAbort: AbortController | null = null;
  let lastView: AccountView | null = null;

  function clearTimer(): void {
    if (timer) {
      clearTimeoutFn(timer);
      timer = null;
    }
  }

  function scheduleNext(): void {
    clearTimer();
    if (stopped) return;
    let delay: number;
    try {
      delay = deps.gate.nextCycleDelayMs(true);
    } catch {
      delay = haltedRecheckMs;
    }
    timer = setTimeoutFn(() => {
      void runCycle().finally(scheduleNext);
    }, delay);
  }

  function commitAndNotify(payload: Parameters<AccountCommitter['commit']>[0]): AccountView {
    const view = deps.store.commit(payload, { gameRunning: true });
    lastView = view;
    deps.onView?.(view);
    return view;
  }

  async function runCycle(): Promise<AccountView | null> {
    if (running) {
      return lastView;
    }
    running = true;
    try {
      const consent = deps.consentStore.read();

      if (!isGranted(consent)) {
        const payload = assembleAccountPayload(allSectionsFailed('not_consented'), deps.now());
        commitAndNotify(payload);
        deps.log.info({ scope: 'account-refresh', event: 'cycle.skipped', decision: consent.decision });
        return lastView;
      }

      const fileResult = readToken(consent);
      if (!fileResult.ok) {
        const payload = assembleAccountPayload(allSectionsFailed('token_unavailable'), deps.now());
        commitAndNotify(payload);
        deps.log.warn({ scope: 'account-refresh', event: 'token.unavailable', reason: fileResult.reason });
        return lastView;
      }

      if (!cachedToken || cachedToken.mtimeMs !== fileResult.mtimeMs) {
        cachedToken = { accountId: fileResult.accountId, token: fileResult.token, mtimeMs: fileResult.mtimeMs };
        deps.gate.resetAuth();
      }

      const session = grantSession(consent, { accountId: cachedToken.accountId, token: cachedToken.token });

      const abortController = new AbortController();
      currentAbort = abortController;
      const abortableTransport = wrapAbortable(deps.transport, abortController.signal);

      const outcomes = {} as Record<AccountSection, SectionOutcome>;
      for (const route of ROUTES) {
        if (abortController.signal.aborted) {
          outcomes[route.section] = { kind: 'failed', reason: 'aborted' };
          continue;
        }
        // The pacing gate is already the single-flight serializer for these five reads; a plain
        // for-loop keeps read order deterministic and matches the gate's own strict-serial
        // contract rather than racing five parallel calls against it.
        const outcome = await readSection(session, abortableTransport, deps.gate, route);
        if (outcome.kind === 'drift') {
          // MP5 F4 (MSG-27): the only runtime consumer of `readSection`'s drift outcome — routes.ts
          // itself stays a pure library with no LogPort. Path-qualified key names only, never a
          // response value: `missingKeys`/`addedKeys` are produced by `checkShape`/`checkSchema`
          // as key paths by construction, so there is no player data (a gold amount, a hero name)
          // to leak here even by accident.
          deps.log.warn({
            scope: 'account-refresh',
            event: 'section.drift',
            section: route.section,
            missingKeys: outcome.missingKeys,
            addedKeys: outcome.addedKeys,
          });
        }
        outcomes[route.section] = outcome;
      }
      currentAbort = null;

      const payload = assembleAccountPayload(outcomes, deps.now());
      commitAndNotify(payload);
      deps.log.info({ scope: 'account-refresh', event: 'cycle.committed' });
      return lastView;
    } finally {
      running = false;
    }
  }

  return {
    start() {
      if (!stopped) return;
      stopped = false;
      void runCycle().finally(scheduleNext);
    },
    stop() {
      stopped = true;
      clearTimer();
      currentAbort?.abort();
      currentAbort = null;
    },
    refreshNow: runCycle,
    onConsentChanged(record: ConsentRecord) {
      if (record.decision === 'granted') {
        void runCycle().finally(scheduleNext);
      } else if (record.decision === 'revoked') {
        currentAbort?.abort();
        currentAbort = null;
        cachedToken = null;
      }
    },
    getLastView() {
      return lastView;
    },
  };
}

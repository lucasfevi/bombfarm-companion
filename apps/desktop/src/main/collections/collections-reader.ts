import type { AccountReadResult, AccountSource } from '@bombfarm/contracts';
import {
  COLLECTIONS_STATE_PATH,
  PacingRefusedError,
  grantSession,
  isGranted,
  requestGet,
  type ConsentRecord,
  type HttpTransport,
  type PacingGate,
  type RequestOutcome,
} from '@bombfarm/game-api';
import type { AccountRefreshDeps } from '../game-api/account-refresh.js';
import type { LogPort } from '../storage/index.js';
import type { CollectionsRecorder } from './collections-recorder.js';

export interface CollectionsReaderDeps {
  readonly consentStore: { read(): ConsentRecord };
  readonly accountSource: () => AccountSource;
  readonly isGameRunning: () => boolean;
  readonly readToken: NonNullable<AccountRefreshDeps['readToken']>;
  readonly transport: HttpTransport;
  readonly gate: PacingGate;
  /** What a read finds goes through the same recorder the tap feeds, so a body the app asked for
   *  and a body the client fetched are one path. */
  readonly recorder: CollectionsRecorder;
  readonly now?: () => number;
  readonly log?: LogPort;
  /** The floor between two triggered reads, so a tab flipped open and shut does not become a
   *  burst of requests. */
  readonly minIntervalMs?: number;
}

export interface CollectionsReader {
  /** Refuses with the same reasons a triggered account read does; `ok` means the read was
   *  started, never that it landed. */
  refresh(): AccountReadResult;
}

const NOOP_LOG: LogPort = { info: () => undefined, warn: () => undefined, error: () => undefined };
const DEFAULT_MIN_INTERVAL_MS = 10_000;

/**
 * The app's own read of the Collections state, made when the tab opens rather than waited for from
 * the client, which fetches it only when the player opens the panel in game. Same consent gate,
 * token, transport and pacing as the account cycle; the route is the one the client requests.
 */
export function createCollectionsReader(deps: CollectionsReaderDeps): CollectionsReader {
  const log = deps.log ?? NOOP_LOG;
  const now = deps.now ?? Date.now;
  const minIntervalMs = deps.minIntervalMs ?? DEFAULT_MIN_INTERVAL_MS;
  let lastStartedAt: number | null = null;
  let inFlight = false;

  async function read(session: ReturnType<typeof grantSession>): Promise<void> {
    let outcome: RequestOutcome;
    try {
      outcome = await deps.gate.run(COLLECTIONS_STATE_PATH, () => requestGet(session, deps.transport, COLLECTIONS_STATE_PATH));
    } catch (error) {
      if (error instanceof PacingRefusedError) {
        log.warn({ scope: 'collections', event: 'read.paced_out', gateState: error.gateState });
        return;
      }
      throw error;
    }
    deps.gate.observe(outcome);
    if (outcome.kind !== 'ok') {
      log.warn({ scope: 'collections', event: 'read.failed', outcome: outcome.kind });
      return;
    }
    deps.recorder.observe({ body: outcome.json, atMs: now() });
  }

  return {
    refresh() {
      if (deps.accountSource() === 'fixture') return { ok: false, reason: 'offline' };
      const consent = deps.consentStore.read();
      if (!isGranted(consent)) return { ok: false, reason: 'not_consented' };
      if (!deps.isGameRunning()) return { ok: false, reason: 'game_not_running' };
      const token = deps.readToken(consent);
      if (!token.ok) return { ok: false, reason: 'token_unavailable' };
      const at = now();
      if (inFlight || (lastStartedAt !== null && at - lastStartedAt < minIntervalMs)) {
        return { ok: false, reason: 'rate_limited' };
      }
      lastStartedAt = at;
      inFlight = true;

      const session = grantSession(consent, { accountId: token.accountId, token: token.token });
      void (async () => {
        try {
          await read(session);
        } catch (error) {
          log.error({ scope: 'collections', event: 'read.threw', error: String(error) });
        } finally {
          inFlight = false;
        }
      })();
      return { ok: true };
    },
  };
}

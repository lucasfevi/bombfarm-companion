import type { AccountReadResult, AccountSource } from '@bombfarm/contracts';
import {
  PVP_STATE_PATH,
  PacingRefusedError,
  grantSession,
  isGranted,
  pvpRankingPath,
  requestGet,
  type ConsentRecord,
  type HttpTransport,
  type PacingGate,
  type RequestOutcome,
} from '@bombfarm/game-api';
import type { AccountRefreshDeps } from '../game-api/account-refresh.js';
import type { LogPort } from '../storage/index.js';
import type { PvpRecorder } from './pvp-recorder.js';

export interface PvpReaderDeps {
  readonly consentStore: { read(): ConsentRecord };
  readonly accountSource: () => AccountSource;
  readonly isGameRunning: () => boolean;
  readonly readToken: NonNullable<AccountRefreshDeps['readToken']>;
  readonly transport: HttpTransport;
  readonly gate: PacingGate;
  /** What a read finds goes through the same recorder the tap feeds, so a body the app asked for
   *  and a body the client fetched are one path — deduplicated and announced alike. */
  readonly recorder: PvpRecorder;
  readonly now?: () => number;
  readonly log?: LogPort;
  /** The floor between two triggered reads, so a tab flipped open and shut does not become a
   *  burst of requests. */
  readonly minIntervalMs?: number;
}

export interface PvpReader {
  /** Refuses with the same reasons a triggered account read does; `ok` means the reads were
   *  started, never that they landed. */
  refresh(): AccountReadResult;
}

const NOOP_LOG: LogPort = { info: () => undefined, warn: () => undefined, error: () => undefined };
const DEFAULT_MIN_INTERVAL_MS = 10_000;

/**
 * The app's own reads of the PVP state and the points ranking — the two bodies the tab's standing
 * is drawn from — made when the tab opens rather than waited for from the client, which polls the
 * state on its own schedule and fetches the ranking only when the player opens it. Same consent
 * gate, token, transport and pacing as the account cycle; the routes are the ones the client
 * requests itself.
 */
export function createPvpReader(deps: PvpReaderDeps): PvpReader {
  const log = deps.log ?? NOOP_LOG;
  const now = deps.now ?? Date.now;
  const minIntervalMs = deps.minIntervalMs ?? DEFAULT_MIN_INTERVAL_MS;
  let lastStartedAt: number | null = null;
  let inFlight = false;

  async function read(session: ReturnType<typeof grantSession>, path: string, route: 'state' | 'ranking'): Promise<void> {
    let outcome: RequestOutcome;
    try {
      outcome = await deps.gate.run(path, () => requestGet(session, deps.transport, path));
    } catch (error) {
      if (error instanceof PacingRefusedError) {
        log.warn({ scope: 'pvp', event: 'read.paced_out', route, gateState: error.gateState });
        return;
      }
      throw error;
    }
    deps.gate.observe(outcome);
    if (outcome.kind !== 'ok') {
      log.warn({ scope: 'pvp', event: 'read.failed', route, outcome: outcome.kind });
      return;
    }
    const raw = Buffer.from(JSON.stringify(outcome.json), 'utf8');
    deps.recorder.observe({ route, body: outcome.json, raw, atMs: now() });
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
          await read(session, PVP_STATE_PATH, 'state');
          await read(session, pvpRankingPath(), 'ranking');
        } catch (error) {
          log.error({ scope: 'pvp', event: 'read.threw', error: String(error) });
        } finally {
          inFlight = false;
        }
      })();
      return { ok: true };
    },
  };
}

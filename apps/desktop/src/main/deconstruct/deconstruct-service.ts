import {
  isDeconstructStartRequest,
  type AccountReadResult,
  type AccountSource,
  type AppSettings,
  type ConsentRecord,
  type DeconstructEvent,
  type DeconstructRunResult,
  type DeconstructStartReason,
  type DeconstructStartResult,
} from '@bombfarm/contracts';
import {
  PacingRefusedError,
  WRITE_ROUTES,
  WriteNotEnabledError,
  createRequestIdSource,
  grantSession,
  grantWriteSession,
  isGranted,
  requestPost,
  type GrantedConsent,
  type HttpTransport,
  type PacingGate,
  type RequestOutcome,
  type WriteSession,
} from '@bombfarm/game-api';
import type { WriterLock } from '../apply/writer-lock.js';
import type { SessionTokenFileResult } from '../game-api/session-token-file.js';
import type { LogPort } from '../storage/index.js';
import type { DeconstructAccountPatch } from './deconstruct-account-patch.js';

/**
 * A deconstruct run: one call that destroys the items it names, so it is made once and never
 * resent. A clean refusal means nothing burned; every other non-success leaves the truth to the
 * account re-read that follows every run. Eligibility (worn, locked, gemmed) is the renderer's
 * pre-filter and the server's verdict, never main's.
 */

export interface DeconstructServiceDeps {
  consentStore: { read(): ConsentRecord };
  readToken: (consent: GrantedConsent) => SessionTokenFileResult;
  settings: () => Pick<AppSettings, 'forgeWritesEnabled'>;
  transport: HttpTransport;
  gate: PacingGate;
  accountSource: () => AccountSource;
  isGameRunning: () => boolean;
  /** The items section rows of the account the renderer is looking at. */
  currentItems: () => readonly unknown[] | null;
  applyResult: (patch: DeconstructAccountPatch) => void;
  writerLock: WriterLock;
  requestReadNow: () => AccountReadResult;
  emit: (event: DeconstructEvent) => void;
  log: LogPort;
  /** Milliseconds. */
  now: () => number;
  random?: () => number;
}

export interface DeconstructService {
  start(request: unknown): DeconstructStartResult;
  isRunning(): boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function itemIdsIn(rows: readonly unknown[] | null): ReadonlySet<string> {
  const ids = new Set<string>();
  for (const row of rows ?? []) {
    if (isRecord(row) && typeof row.id === 'string') ids.add(row.id);
  }
  return ids;
}

/** A 200 without a numeric balance is a failure, exactly as the game client reads it; the count
 *  and the gain are optional on the wire and default the way the client defaults them. */
function burnedResult(json: unknown, requested: number): DeconstructRunResult | null {
  if (!isRecord(json) || !isNonNegativeInteger(json.essence)) return null;
  return {
    status: 'burned',
    essence: json.essence,
    burned: isNonNegativeInteger(json.queimados) ? json.queimados : requested,
    gained: isNonNegativeInteger(json.ganho) ? json.ganho : 0,
  };
}

function resultOf(outcome: RequestOutcome, requested: number): DeconstructRunResult {
  switch (outcome.kind) {
    case 'ok':
      return burnedResult(outcome.json, requested) ?? { status: 'failed', reason: 'unreadable' };
    case 'api_error':
      return { status: 'refused', code: outcome.code };
    case 'unauthorized':
      return { status: 'failed', reason: 'session' };
    case 'cooldown':
      return { status: 'failed', reason: 'cooldown' };
    case 'malformed_json':
    case 'too_large':
      return { status: 'failed', reason: 'unreadable' };
    case 'http_error':
    case 'transport_error':
      return { status: 'failed', reason: 'network' };
  }
}

export function createDeconstructService(deps: DeconstructServiceDeps): DeconstructService {
  const random = deps.random ?? Math.random;
  const startedAtMs = deps.now();
  const requestIds = createRequestIdSource({ uptimeMs: () => deps.now() - startedAtMs, random });
  let activeRunId: string | null = null;
  let sequence = 0;

  async function burn(runId: string, session: WriteSession, itemIds: readonly string[]): Promise<DeconstructRunResult> {
    let outcome: RequestOutcome;
    try {
      outcome = await deps.gate.runWrite('deconstruct', () =>
        requestPost(session, deps.transport, { route: WRITE_ROUTES.deconstruct, items: itemIds }, requestIds.next()),
      );
    } catch (err) {
      if (err instanceof PacingRefusedError) {
        deps.log.warn({ scope: 'deconstruct', event: 'run.refused_by_gate', runId, error: String(err) });
        return { status: 'failed', reason: err.gateState === 'halted' ? 'session' : 'cooldown' };
      }
      deps.log.error({ scope: 'deconstruct', event: 'run.failed', runId, error: String(err) });
      return { status: 'failed', reason: 'error' };
    }
    deps.gate.observe(outcome);
    return resultOf(outcome, itemIds.length);
  }

  function settleAccount(runId: string, itemIds: readonly string[], result: DeconstructRunResult): void {
    try {
      if (result.status === 'burned') deps.applyResult({ itemIds, essence: result.essence });
    } catch (err) {
      deps.log.error({ scope: 'deconstruct', event: 'run.apply_failed', runId, error: String(err) });
    }
    try {
      const read = deps.requestReadNow();
      if (!read.ok) deps.log.warn({ scope: 'deconstruct', event: 'run.read_now_refused', runId, reason: read.reason });
    } catch (err) {
      deps.log.error({ scope: 'deconstruct', event: 'run.read_now_failed', runId, error: String(err) });
    }
  }

  function describe(result: DeconstructRunResult): Record<string, unknown> {
    switch (result.status) {
      case 'burned':
        return { status: result.status, burned: result.burned, gained: result.gained };
      case 'refused':
        return { status: result.status, code: result.code };
      case 'failed':
        return { status: result.status, reason: result.reason };
    }
  }

  async function run(runId: string, session: WriteSession, itemIds: readonly string[]): Promise<void> {
    let result: DeconstructRunResult = { status: 'failed', reason: 'error' };
    try {
      result = await burn(runId, session, itemIds);
      settleAccount(runId, itemIds, result);
    } catch (err) {
      deps.log.error({ scope: 'deconstruct', event: 'run.failed', runId, error: String(err) });
    } finally {
      deps.writerLock.release('deconstruct');
      activeRunId = null;
      deps.log.info({ scope: 'deconstruct', event: 'run.finished', runId, items: itemIds.length, ...describe(result) });
      deps.emit({ type: 'done', runId, itemIds: [...itemIds], result });
    }
  }

  function refuse(reason: DeconstructStartReason): DeconstructStartResult {
    deps.log.info({ scope: 'deconstruct', event: 'run.refused', reason });
    return { ok: false, reason };
  }

  return {
    start(request) {
      if (!isDeconstructStartRequest(request)) return refuse('bad_request');
      if (activeRunId !== null || deps.writerLock.holder !== null) return refuse('busy');
      if (deps.accountSource() === 'fixture') return refuse('offline');

      const known = itemIdsIn(deps.currentItems());
      if (!request.itemIds.every((id) => known.has(id))) return refuse('unknown_item');

      const consent = deps.consentStore.read();
      if (!isGranted(consent)) return refuse('not_consented');
      if (!deps.isGameRunning()) return refuse('game_not_running');

      const token = deps.readToken(consent);
      if (!token.ok) return refuse('token_unavailable');

      let session: WriteSession;
      try {
        session = grantWriteSession(grantSession(consent, { accountId: token.accountId, token: token.token }), deps.settings());
      } catch (err) {
        if (err instanceof WriteNotEnabledError) return refuse('writes_disabled');
        throw err;
      }

      sequence += 1;
      const runId = `${String(deps.now())}-${String(sequence)}`;
      const itemIds = [...request.itemIds];
      deps.writerLock.acquire('deconstruct');
      activeRunId = runId;
      deps.log.info({ scope: 'deconstruct', event: 'run.started', runId, items: itemIds.length });
      void run(runId, session, itemIds).catch((err: unknown) => {
        deps.log.error({ scope: 'deconstruct', event: 'run.emit_failed', runId, error: String(err) });
      });
      return { ok: true, runId };
    },

    isRunning() {
      return activeRunId !== null;
    },
  };
}

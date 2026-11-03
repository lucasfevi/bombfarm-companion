import {
  TRACKING_DB_LIMITS,
  TRACKING_DB_STATEMENTS,
  type DbAnswer,
  type DbArgs,
  type DbParam,
  type DbRefusalReason,
  type DbValue,
} from '@bombfarm/contracts';
import type { LogPort } from '../../../storage/index.js';
import {
  EngineStatementError,
  type DbSession,
  type StatementErrorKind,
  type StatementInfo,
} from '../../tracking/engine.js';
import { TrackingUnavailableError, type TrackingStore } from '../../tracking/tracking-store.js';
import { CapabilityError, withOrigin, type CallOrigin, type CapabilityHandler } from '../capability-channel.js';

export interface DbCapabilityDeps {
  /** The signed-in user's id; null while signed out. */
  subject(): string | null;
  readonly store: TrackingStore;
  /** Milliseconds from a steady clock; the audit's `ms` is measured on it. */
  mono(): number;
  readonly log: LogPort;
  /** Test seam: the statement timeout. Defaults to the contract's 10 s. */
  statementMs?: number;
}

type Step = { sql: string; params: readonly DbParam[] };

/** `CREATE [OR REPLACE] [TEMPORARY | PERSISTENT] SECRET`, after any leading space or comments. */
const CREATE_SECRET = /^(?:\s|--[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/)*create\s+(?:(?:or\s+replace|temp\w*|persistent)\s+)*secret\b/i;

/** Nothing but space, comments and semicolons: no statement at all. */
const NO_STATEMENT = /^(?:\s|;|--[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/)*$/;

const ENGINE_KINDS: Readonly<Record<Exclude<StatementErrorKind, 'interrupted' | 'bind'>, DbRefusalReason>> = {
  disk_full: 'disk_full',
  constraint: 'constraint',
  catalog: 'catalog',
  conversion: 'conversion',
  other: 'other',
};

const bytesOf = (value: unknown): number => Buffer.byteLength(JSON.stringify(value), 'utf8');
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function isParam(value: unknown): value is DbParam {
  return (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isFinite(value))
  );
}

/** A parameter list: scalars only, at most `params` of them. */
function paramList(value: unknown): readonly DbParam[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || !value.every(isParam)) throw new CapabilityError('bad_args', 'shape');
  if (value.length > TRACKING_DB_LIMITS.params) throw new CapabilityError('too_large', 'params');
  return value;
}

function sqlText(value: unknown): string {
  if (typeof value !== 'string') throw new CapabilityError('bad_args', 'shape');
  if (Buffer.byteLength(value, 'utf8') > TRACKING_DB_LIMITS.sqlBytes) throw new CapabilityError('too_large', 'bytes');
  return value;
}

function toValue(value: unknown): DbValue {
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  // Lists, structs and maps have no scalar form: they arrive as their JSON text.
  return JSON.stringify(value);
}

/**
 * `db`: the signed-in user's tracking file, through SQL with positional parameters. The worker has
 * every op; the Premium screen has `query` (SELECT only), `size` and `status`. Each statement is
 * parsed by DuckDB and checked against the allow-lists before it runs; nothing the engine, the SQL
 * or the parameters say reaches a reply or the log.
 */
export function createDbCapability(deps: DbCapabilityDeps): CapabilityHandler {
  const { store, log } = deps;
  const limits = TRACKING_DB_LIMITS;
  const statementMs = deps.statementMs ?? limits.statementMs;

  function currentSubject(): string {
    const subject = deps.subject();
    if (subject === null || subject === '') throw new CapabilityError('unavailable', 'no_subject');
    return subject;
  }

  /** Parse, prepare and type-check one statement; throws the refusal, never runs anything. */
  async function gate(
    session: DbSession,
    sql: string,
    paramCount: number,
    allowed: readonly string[],
    origin: CallOrigin,
  ): Promise<StatementInfo> {
    if (NO_STATEMENT.test(sql)) throw new CapabilityError('bad_args', 'statement_count');
    // DuckDB cannot prepare a secret without its extension, so this one is read before it is asked.
    if (CREATE_SECRET.test(sql)) {
      throw origin === 'ui' ? new CapabilityError('not_granted') : new CapabilityError('bad_args', 'statement_type');
    }
    const info = await session.inspect(sql);
    if (info.count !== 1) throw new CapabilityError('bad_args', 'statement_count');
    if (!allowed.includes(info.type)) {
      throw origin === 'ui' ? new CapabilityError('not_granted') : new CapabilityError('bad_args', 'statement_type');
    }
    if (info.parameters !== paramCount) throw new CapabilityError('bad_args', 'bind');
    return info;
  }

  /** Runs `work` alone on the connection under the statement timeout; the interrupt ends the statement in flight. */
  function timed<T>(work: (session: DbSession, expired: () => boolean) => Promise<T>, subject: string): Promise<T> {
    return store.db(subject).then((db) =>
      db.session(async (session) => {
        const timing = { expired: false };
        const timer = setTimeout(() => {
          timing.expired = true;
          try {
            session.interrupt();
          } catch {
            // the statement may already be over
          }
        }, statementMs);
        try {
          return await work(session, () => timing.expired);
        } catch (error) {
          if (timing.expired) throw new CapabilityError('timeout');
          throw error;
        } finally {
          clearTimeout(timer);
        }
      }),
    );
  }

  /** BEGIN, the body, COMMIT; any failure rolls everything back first. */
  async function inTransaction<T>(session: DbSession, expired: () => boolean, body: () => Promise<T>): Promise<T> {
    await session.run('BEGIN');
    try {
      const result = await body();
      if (expired()) throw new EngineStatementError('interrupted');
      await session.run('COMMIT');
      return result;
    } catch (error) {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          await session.run('ROLLBACK');
          break;
        } catch {
          // an interrupt can land on the rollback itself; once more, then the connection is lost with the handle
        }
      }
      throw error;
    }
  }

  async function query(args: Record<string, unknown>, origin: CallOrigin): Promise<DbAnswer['query']> {
    const sql = sqlText(args['sql']);
    const params = paramList(args['params']);
    const subject = currentSubject();
    const allowed = origin === 'ui' ? TRACKING_DB_STATEMENTS.ui : TRACKING_DB_STATEMENTS.worker;
    return timed(async (session) => {
      await gate(session, sql, params.length, allowed, origin);
      const result = await session.query(sql, params, limits.resultRows + 1);
      if (result.rows.length > limits.resultRows) throw new CapabilityError('too_large', 'rows');
      const rows = result.rows.map((row) => row.map(toValue));
      let total = 0;
      for (const row of rows) {
        total += bytesOf(row);
        if (total > limits.resultBytes) throw new CapabilityError('too_large', 'bytes');
      }
      return { columns: result.columns, rows };
    }, subject);
  }

  async function exec(args: Record<string, unknown>): Promise<DbAnswer['exec']> {
    const sql = sqlText(args['sql']);
    const params = paramList(args['params']);
    const subject = currentSubject();
    return timed(async (session) => {
      await gate(session, sql, params.length, TRACKING_DB_STATEMENTS.worker, 'worker');
      return { changes: await session.run(sql, params) };
    }, subject);
  }

  async function batch(args: Record<string, unknown>): Promise<DbAnswer['batch']> {
    const sql = sqlText(args['sql']);
    const rows = args['rows'];
    if (!Array.isArray(rows)) throw new CapabilityError('bad_args', 'shape');
    if (rows.length > limits.batchRows) throw new CapabilityError('too_large', 'params');
    const width = Array.isArray(rows[0]) ? (rows[0] as unknown[]).length : 0;
    const parsed: (readonly DbParam[])[] = [];
    for (const row of rows) {
      if (!Array.isArray(row) || row.length !== width) throw new CapabilityError('bad_args', 'shape');
      parsed.push(paramList(row));
    }
    if (bytesOf(parsed) > limits.writeParamBytes) throw new CapabilityError('too_large', 'bytes');
    const subject = currentSubject();
    return timed(async (session, expired) => {
      await gate(session, sql, width, TRACKING_DB_STATEMENTS.batch, 'worker');
      return inTransaction(session, expired, async () => {
        let changes = 0;
        for (const row of parsed) {
          changes += await session.run(sql, row);
          if (expired()) throw new EngineStatementError('interrupted');
        }
        return { changes };
      });
    }, subject);
  }

  async function tx(args: Record<string, unknown>): Promise<DbAnswer['tx']> {
    const raw = args['steps'];
    if (!Array.isArray(raw)) throw new CapabilityError('bad_args', 'shape');
    if (raw.length > limits.txSteps) throw new CapabilityError('too_large', 'params');
    const steps: Step[] = raw.map((step: unknown) => {
      if (!isRecord(step)) throw new CapabilityError('bad_args', 'shape');
      return { sql: sqlText(step['sql']), params: paramList(step['params']) };
    });
    if (bytesOf(steps.map((step) => step.params)) > limits.writeParamBytes) {
      throw new CapabilityError('too_large', 'bytes');
    }
    const subject = currentSubject();
    return timed(async (session, expired) => {
      // Each step is checked just before it runs, inside the transaction, so a step may use a
      // table an earlier step created; a refusal rolls the earlier steps back.
      return inTransaction(session, expired, async () => {
        const changes: number[] = [];
        for (const step of steps) {
          await gate(session, step.sql, step.params.length, TRACKING_DB_STATEMENTS.tx, 'worker');
          changes.push(await session.run(step.sql, step.params));
          if (expired()) throw new EngineStatementError('interrupted');
        }
        return { changes };
      });
    }, subject);
  }

  function size(): DbAnswer['size'] {
    const view = store.status(currentSubject());
    if (view.state === 'present') return { bytes: view.bytes };
    if (view.state === 'engine_unavailable') return { bytes: view.bytes ?? 0 };
    return { bytes: 0 };
  }

  async function status(): Promise<DbAnswer['status']> {
    const subject = deps.subject();
    if (subject === null || subject === '') return { state: 'unavailable', reason: 'no_subject' };
    try {
      await store.db(subject);
      return { state: 'ready' };
    } catch (error) {
      if (error instanceof TrackingUnavailableError) return { state: 'unavailable', reason: error.reason };
      throw error;
    }
  }

  /** What every failure becomes: a named refusal, never engine text. */
  function refusal(error: unknown): CapabilityError {
    if (error instanceof CapabilityError) return error;
    if (error instanceof TrackingUnavailableError) return new CapabilityError('unavailable', error.reason);
    if (error instanceof EngineStatementError) {
      if (error.kind === 'interrupted') return new CapabilityError('timeout');
      if (error.kind === 'bind') return new CapabilityError('bad_args', 'bind');
      return new CapabilityError('failed', ENGINE_KINDS[error.kind]);
    }
    return new CapabilityError('failed', 'other');
  }

  function audit(op: string, outcome: string, reason: string | undefined, ms: number, origin: CallOrigin, steps: number) {
    try {
      log.info({
        scope: 'premium',
        event: 'premium.db',
        op,
        outcome,
        ...(reason === undefined ? {} : { reason }),
        ms,
        origin,
        steps,
      });
    } catch {
      // a failing log must not change the answer
    }
  }

  return withOrigin(async (args, ctx) => {
    const started = deps.mono();
    const origin = ctx.origin;
    let op = 'unknown';
    let steps = 1;
    let outcome = 'ok';
    let reason: string | undefined;
    try {
      if (!isRecord(args) || typeof args['op'] !== 'string') throw new CapabilityError('bad_args', 'shape');
      const call = args as Record<string, unknown> & { op: DbArgs['op'] };
      switch (call.op) {
        case 'query':
          op = 'query';
          return await query(call, origin);
        case 'size':
          op = 'size';
          return size();
        case 'status':
          op = 'status';
          return await status();
        case 'exec':
        case 'batch':
        case 'tx':
          op = call.op;
          if (origin === 'ui') throw new CapabilityError('not_granted');
          if (call.op === 'tx' && Array.isArray(call['steps'])) steps = call['steps'].length;
          if (call.op === 'exec') return await exec(call);
          return call.op === 'batch' ? await batch(call) : await tx(call);
        default:
          throw new CapabilityError('bad_args', 'shape');
      }
    } catch (error) {
      const failure = refusal(error);
      outcome = failure.code;
      reason = failure.reason;
      throw failure;
    } finally {
      audit(op, outcome, reason, Math.max(0, deps.mono() - started), origin, steps);
    }
  });
}

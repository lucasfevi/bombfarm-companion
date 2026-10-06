import { EMPTY_FORGE_HISTORY, type ForgeHistoryResult, type ForgeHistoryRow, type ForgeStopReason } from '@bombfarm/contracts';
import type { LogPort, SqliteDb } from '../storage/index.js';

/**
 * The forge ledger, one row per run, over the same database the account store opens — the
 * settings and window-layout stores borrow that handle the same way. The table is additive
 * (`CREATE TABLE IF NOT EXISTS` beside the account tables), so `SCHEMA_VERSION` does not move:
 * that version only refuses a file written by a newer build, and an older build simply never
 * reads this table.
 */
export const INIT_FORGE_RUNS_SQL = `
CREATE TABLE IF NOT EXISTS forge_runs (
  id           INTEGER PRIMARY KEY,
  started_at   TEXT NOT NULL,
  finished_at  TEXT NOT NULL,
  account_id   TEXT NOT NULL,
  item_id      TEXT NOT NULL,
  def_id       TEXT NOT NULL,
  rarity       INTEGER NOT NULL,
  slot         INTEGER,
  item_level   INTEGER NOT NULL,
  from_upgrade INTEGER NOT NULL,
  to_upgrade   INTEGER NOT NULL,
  target       INTEGER NOT NULL,
  stop         TEXT NOT NULL,
  reached      INTEGER NOT NULL,
  rolls        INTEGER NOT NULL,
  fails        INTEGER NOT NULL,
  crits        INTEGER NOT NULL,
  safe_jumps   INTEGER NOT NULL,
  spent        INTEGER NOT NULL,
  wallet_after INTEGER,
  duration_ms  INTEGER NOT NULL,
  stones_spent TEXT,
  stone_rarity INTEGER
);
`;

/** A ledger file written before stones existed lacks these two columns; they are added in place and
 *  an older row reads as no stones spent. */
const ADD_STONE_COLUMNS_SQL = [
  'ALTER TABLE forge_runs ADD COLUMN stones_spent TEXT',
  'ALTER TABLE forge_runs ADD COLUMN stone_rarity INTEGER',
];

const NO_STONES: readonly number[] = [0, 0, 0, 0, 0, 0];

function parseStonesSpent(text: string | null): readonly number[] {
  if (text === null) return NO_STONES;
  try {
    const parsed: unknown = JSON.parse(text);
    if (!Array.isArray(parsed) || parsed.length !== NO_STONES.length) return NO_STONES;
    return parsed.every((count) => typeof count === 'number' && Number.isInteger(count) && count >= 0)
      ? (parsed as number[])
      : NO_STONES;
  } catch {
    return NO_STONES;
  }
}

export type ForgeRunRecord = Omit<ForgeHistoryRow, 'id'>;

export interface ForgeHistory {
  append(record: ForgeRunRecord): void;
  list(opts: { limit: number }): ForgeHistoryResult;
  clear(): void;
}

interface StoredRow {
  id: number;
  started_at: string;
  finished_at: string;
  account_id: string;
  item_id: string;
  def_id: string;
  rarity: number;
  slot: number | null;
  item_level: number;
  from_upgrade: number;
  to_upgrade: number;
  target: number;
  stop: string;
  reached: number;
  rolls: number;
  fails: number;
  crits: number;
  safe_jumps: number;
  spent: number;
  wallet_after: number | null;
  duration_ms: number;
  stones_spent: string | null;
  stone_rarity: number | null;
}

interface TotalsRow {
  runs: number;
  spent: number | null;
  rolls: number | null;
  fails: number | null;
}

const NOOP_LOG: LogPort = { info: () => undefined, warn: () => undefined, error: () => undefined };

function toRow(stored: StoredRow): ForgeHistoryRow {
  return {
    id: stored.id,
    startedAt: stored.started_at,
    finishedAt: stored.finished_at,
    accountId: stored.account_id,
    itemId: stored.item_id,
    defId: stored.def_id,
    rarity: stored.rarity,
    slot: stored.slot,
    itemLevel: stored.item_level,
    fromUpgrade: stored.from_upgrade,
    toUpgrade: stored.to_upgrade,
    target: stored.target,
    stop: stored.stop as ForgeStopReason,
    reached: stored.reached === 1,
    rolls: stored.rolls,
    fails: stored.fails,
    crits: stored.crits,
    safeJumps: stored.safe_jumps,
    spent: stored.spent,
    walletAfter: stored.wallet_after,
    durationMs: stored.duration_ms,
    stonesSpent: parseStonesSpent(stored.stones_spent),
    stoneRarity: stored.stone_rarity,
  };
}

export function createForgeHistory(db: SqliteDb | null, log: LogPort = NOOP_LOG): ForgeHistory {
  if (db) {
    try {
      db.exec(INIT_FORGE_RUNS_SQL);
      const columns = db.prepare('PRAGMA table_info(forge_runs)').all() as { name: string }[];
      if (!columns.some((column) => column.name === 'stones_spent')) {
        for (const statement of ADD_STONE_COLUMNS_SQL) db.exec(statement);
      }
    } catch (err) {
      log.error({ scope: 'forge', event: 'history.init_failed', error: String(err) });
    }
  }

  return {
    append(record) {
      if (!db) return;
      try {
        db.prepare(
          'INSERT INTO forge_runs (started_at, finished_at, account_id, item_id, def_id, rarity, slot, item_level, ' +
            'from_upgrade, to_upgrade, target, stop, reached, rolls, fails, crits, safe_jumps, spent, wallet_after, duration_ms, ' +
            'stones_spent, stone_rarity) ' +
            'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        ).run(
          record.startedAt,
          record.finishedAt,
          record.accountId,
          record.itemId,
          record.defId,
          record.rarity,
          record.slot,
          record.itemLevel,
          record.fromUpgrade,
          record.toUpgrade,
          record.target,
          record.stop,
          record.reached ? 1 : 0,
          record.rolls,
          record.fails,
          record.crits,
          record.safeJumps,
          record.spent,
          record.walletAfter,
          record.durationMs,
          JSON.stringify(record.stonesSpent),
          record.stoneRarity,
        );
      } catch (err) {
        log.error({ scope: 'forge', event: 'history.append_failed', error: String(err) });
      }
    },

    list({ limit }) {
      if (!db) return EMPTY_FORGE_HISTORY;
      try {
        const rows = db.prepare('SELECT * FROM forge_runs ORDER BY id DESC LIMIT ?').all(limit) as StoredRow[];
        const totals = db
          .prepare('SELECT COUNT(*) AS runs, SUM(spent) AS spent, SUM(rolls) AS rolls, SUM(fails) AS fails FROM forge_runs')
          .get() as TotalsRow | undefined;
        return {
          rows: rows.map(toRow),
          totals: {
            runs: totals?.runs ?? 0,
            spent: totals?.spent ?? 0,
            rolls: totals?.rolls ?? 0,
            fails: totals?.fails ?? 0,
          },
        };
      } catch (err) {
        log.error({ scope: 'forge', event: 'history.list_failed', error: String(err) });
        return EMPTY_FORGE_HISTORY;
      }
    },

    clear() {
      if (!db) return;
      try {
        db.prepare('DELETE FROM forge_runs').run();
      } catch (err) {
        log.error({ scope: 'forge', event: 'history.clear_failed', error: String(err) });
      }
    },
  };
}

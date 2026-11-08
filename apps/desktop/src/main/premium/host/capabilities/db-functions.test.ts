import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTrackingEngine, type LockedDb } from '../../tracking/engine.js';
import { currentPlatformExtension } from '../../tracking/test-extension.js';
import {
  ALLOWED_FUNCTIONS,
  ALLOWED_TABLE_FUNCTIONS,
  EXCLUDED_FUNCTION_NAMES,
  EXCLUDED_FUNCTION_PREFIXES,
  EXTRA_ALLOWED_FUNCTIONS,
} from './db-functions.js';

let scratch = '';
let db: LockedDb | undefined;

async function names(types: string): Promise<string[]> {
  const rows = await (db as LockedDb).query(
    `SELECT DISTINCT lower(function_name) AS n FROM duckdb_functions() WHERE internal AND function_type IN (${types}) ORDER BY 1`,
  );
  return rows.map((row) => String(row['n']));
}

beforeAll(async () => {
  const extensionPath = await currentPlatformExtension();
  scratch = mkdtempSync(join(tmpdir(), 'bfc-allowlist-'));
  const noop = (): void => undefined;
  db = await createTrackingEngine({ extensionPath, log: { info: noop, warn: noop, error: noop } }).open(
    join(scratch, 'track.duckdb'),
    'e5'.repeat(32),
  );
}, 120_000);

afterAll(() => {
  db?.close();
  rmSync(scratch, { recursive: true, force: true });
});

describe('the function allow list, against the engine it ships with', () => {
  it('is exactly the engine scalar, aggregate and macro functions minus the named exclusions', async () => {
    const live = await names("'scalar', 'aggregate', 'macro'");
    const expected = new Set([
      ...live.filter(
        (name) =>
          !EXCLUDED_FUNCTION_NAMES.includes(name) && !EXCLUDED_FUNCTION_PREFIXES.some((prefix) => name.startsWith(prefix)),
      ),
      ...EXTRA_ALLOWED_FUNCTIONS,
    ]);
    // A DuckDB upgrade that adds, removes or renames a function fails here until the list is reviewed.
    expect([...ALLOWED_FUNCTIONS].sort()).toEqual([...expected].sort());
  });

  it('names every exclusion as a function the engine really ships', async () => {
    const live = new Set(await names("'scalar', 'aggregate', 'macro'"));
    for (const name of EXCLUDED_FUNCTION_NAMES) expect(live.has(name), name).toBe(true);
  });

  it('holds nothing that reads or changes settings, files, sequences, the catalog or the logger', () => {
    for (const name of [
      'nextval', 'currval', 'setval', 'current_setting', 'current_query', 'current_database', 'current_schema',
      'getenv', 'query', 'query_table', 'enable_logging', 'disable_logging', 'truncate_duckdb_logs', 'checkpoint',
      'force_checkpoint', 'glob', 'read_csv', 'read_json', 'read_parquet', 'read_text', 'sniff_csv', 'duckdb_databases',
      'duckdb_settings', 'pragma_database_list', 'json_serialize_sql', 'json_execute_serialized_sql', 'write_log',
      'sleep_ms', 'pg_sleep', 'setseed', 'getvariable', 'which_secret', 'copy_database',
    ]) {
      expect(ALLOWED_FUNCTIONS.has(name), name).toBe(false);
    }
  });

  it('keeps the ordinary scalar, aggregate and window functions', () => {
    for (const name of [
      'json_extract', 'json_extract_string', 'strftime', 'date_trunc', 'date_diff', 'count_star', 'sum', 'avg',
      'min', 'max', 'quantile_cont', 'list_transform', 'list_filter', 'row_number', 'rank', 'lag', 'lead', 'first_value',
      'upper', 'lower', 'length', 'round', 'abs', 'epoch_ms', 'list_value', 'struct_pack', 'regexp_matches', '+', '||',
    ]) {
      expect(ALLOWED_FUNCTIONS.has(name), name).toBe(true);
    }
  });

  it('allows only five table functions, each a table function the engine ships', async () => {
    expect([...ALLOWED_TABLE_FUNCTIONS].sort()).toEqual(['generate_series', 'json_each', 'json_tree', 'range', 'unnest']);
    const tables = new Set(await names("'table', 'table_macro'"));
    for (const name of ALLOWED_TABLE_FUNCTIONS) expect(tables.has(name), name).toBe(true);
  });
});

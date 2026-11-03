import { ALLOWED_FUNCTIONS, ALLOWED_TABLE_FUNCTIONS } from './db-functions.js';

/**
 * What a tracking statement may contain, decided on how DuckDB itself reads it, never on a lexer
 * of ours that could read a string, comment or space differently.
 *
 * - A SELECT is serialised by DuckDB's own parser (`json_serialize_sql`) and the tree is checked:
 *   every function must be in `ALLOWED_FUNCTIONS`, a table function in `ALLOWED_TABLE_FUNCTIONS`,
 *   a table reference of a known kind, and no table may be a system view.
 * - DuckDB serialises only SELECT, so any other statement (the worker's INSERT, UPDATE, DELETE,
 *   MERGE, CREATE, ALTER, DROP) is read by `lexicalPolicy`: it accepts only a plain subset of the
 *   language, where our reading and DuckDB's cannot differ, and inside it refuses every word that
 *   names a built-in function the allow list does not carry.
 */

const REF_TYPES = new Set(['BASE_TABLE', 'SUBQUERY', 'JOIN', 'TABLE_FUNCTION', 'EXPRESSION_LIST', 'EMPTY']);
const SYSTEM_TABLE_PREFIXES = ['duckdb_', 'pragma_', 'pg_', 'sqlite_'];
const SYSTEM_SCHEMAS = new Set(['information_schema', 'pg_catalog']);
/** What a non-SELECT statement the worker may send starts with. */
const DML_STARTS = new Set(['insert', 'update', 'delete', 'merge', 'create', 'alter', 'drop', 'with']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function systemName(name: string): boolean {
  const lower = name.toLowerCase();
  return SYSTEM_TABLE_PREFIXES.some((prefix) => lower.startsWith(prefix)) || lower === 'information_schema';
}

function walk(value: unknown, skipOwnName: boolean): boolean {
  if (Array.isArray(value)) return value.every((item) => walk(item, false));
  if (!isRecord(value)) return true;

  if (typeof value['function_name'] === 'string' && !skipOwnName) {
    if (!ALLOWED_FUNCTIONS.has(value['function_name'].toLowerCase())) return false;
  }
  // A table reference carries a `sample` key, as does a query node (`…_NODE`), which is not one.
  if ('sample' in value && !String(value['type']).endsWith('_NODE')) {
    const type = value['type'];
    if (typeof type !== 'string' || !REF_TYPES.has(type)) return false;
    if (type === 'BASE_TABLE') {
      const table = value['table_name'];
      const schema = value['schema_name'];
      if (typeof table !== 'string' || systemName(table)) return false;
      if (typeof schema === 'string' && SYSTEM_SCHEMAS.has(schema.toLowerCase())) return false;
    }
    if (type === 'TABLE_FUNCTION') {
      const call = value['function'];
      if (!isRecord(call) || typeof call['function_name'] !== 'string') return false;
      if (!ALLOWED_TABLE_FUNCTIONS.has(call['function_name'].toLowerCase())) return false;
      return Object.entries(value).every(([key, child]) => walk(child, key === 'function'));
    }
  }
  return Object.values(value).every((child) => walk(child, false));
}

/**
 * Whether a parse tree from `json_serialize_sql` holds only what a query may use. `serialised` is
 * the function's JSON text; an error result is not a tree and is the caller's to handle.
 */
export function treePolicy(serialised: string): 'ok' | 'refused' | 'not_select' {
  let tree: unknown;
  try {
    tree = JSON.parse(serialised);
  } catch {
    return 'refused';
  }
  if (!isRecord(tree)) return 'refused';
  if (tree['error'] === true) return 'not_select';
  const statements = tree['statements'];
  if (!Array.isArray(statements) || statements.length !== 1) return 'refused';
  return walk(statements, false) ? 'ok' : 'refused';
}

/** The names of every built-in function the engine ships, lower case: the words `lexicalPolicy` weighs. */
export type BuiltinNames = ReadonlySet<string>;

/**
 * The policy for a statement DuckDB cannot serialise. It reads only the plain subset: ASCII outside
 * single-quoted strings, no comments, no prefixed strings (`E'…'`, `U&'…'`), no dollar quoting, no
 * backslash. Inside it, a word is refused when it is a built-in function name outside the allow
 * lists or starts a system-table name; the statement must start like a worker write; and
 * `CREATE SECRET` is refused. Anything outside the subset is refused too.
 */
export function lexicalPolicy(sql: string, builtins: BuiltinNames): boolean {
  const n = sql.length;
  const words: string[] = [];
  let i = 0;
  while (i < n) {
    const ch = sql.charCodeAt(i);
    const c = sql[i] as string;
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') {
      i += 1;
    } else if (ch < 0x20 || ch > 0x7e) {
      return false;
    } else if (c === "'") {
      if (/[A-Za-z0-9_$&]/.test(sql[i - 1] ?? '')) return false;
      i += 1;
      for (;;) {
        if (i >= n) return false;
        if (sql[i] === "'") {
          if (sql[i + 1] === "'") i += 2;
          else break;
        } else {
          i += 1;
        }
      }
      i += 1;
    } else if (c === '"') {
      if (/[A-Za-z0-9_$&]/.test(sql[i - 1] ?? '')) return false;
      let name = '';
      i += 1;
      for (;;) {
        if (i >= n) return false;
        const q = sql.charCodeAt(i);
        if (q < 0x20 || q > 0x7e) return false;
        if (sql[i] === '"') {
          if (sql[i + 1] === '"') {
            name += '"';
            i += 2;
          } else {
            break;
          }
        } else {
          name += sql[i] as string;
          i += 1;
        }
      }
      i += 1;
      words.push(name.toLowerCase());
    } else if ((c === '-' && sql[i + 1] === '-') || (c === '/' && sql[i + 1] === '*') || c === '\\') {
      return false;
    } else if (c === '$') {
      if (!/[0-9]/.test(sql[i + 1] ?? '')) return false;
      i += 1;
      while (i < n && /[0-9]/.test(sql[i] as string)) i += 1;
    } else if (/[0-9]/.test(c)) {
      while (i < n && /[A-Za-z0-9_.]/.test(sql[i] as string)) i += 1;
    } else if (/[A-Za-z_]/.test(c)) {
      const start = i;
      while (i < n && /[A-Za-z0-9_$]/.test(sql[i] as string)) i += 1;
      words.push(sql.slice(start, i).toLowerCase());
    } else {
      i += 1;
    }
  }

  const first = words[0];
  if (first === undefined || !DML_STARTS.has(first)) return false;
  if (first === 'create' && words.slice(1, 6).includes('secret')) return false;
  return words.every((word) => {
    if (systemName(word)) return false;
    if (!builtins.has(word)) return true;
    return ALLOWED_FUNCTIONS.has(word) || ALLOWED_TABLE_FUNCTIONS.has(word);
  });
}

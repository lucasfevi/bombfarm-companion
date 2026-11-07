import { describe, expect, it } from 'vitest';
import { lexicalPolicy, treePolicy } from './db-policy.js';

const BUILTINS = new Set(['sum', 'nextval']);

describe('lexicalPolicy, the first layer for a statement DuckDB cannot serialise', () => {
  it.each([
    ['PRAGMA database_list'],
    ['pragma database_list'],
    ['Pragma database_list;'],
    ['  \n\tPRAGMA platform'],
    ['PRAGMA'],
  ])('refuses %j by its first word alone', (sql) => {
    expect(lexicalPolicy(sql, BUILTINS)).toBe(false);
  });

  it('refuses an empty or word-less statement', () => {
    expect(lexicalPolicy('', BUILTINS)).toBe(false);
    expect(lexicalPolicy('   ', BUILTINS)).toBe(false);
  });

  it('accepts a plain worker write', () => {
    expect(lexicalPolicy("INSERT INTO drops (id) VALUES (1)", BUILTINS)).toBe(true);
  });
});

describe('treePolicy on a bare keyword column', () => {
  const tree = (names: string[]): string =>
    JSON.stringify({
      error: false,
      statements: [{ node: { select_list: [{ class: 'COLUMN_REF', type: 'COLUMN_REF', column_names: names }] } }],
    });

  it.each([['current_catalog'], ['current_schema'], ['CURRENT_SCHEMA']])('refuses a sole column named %s', (name) => {
    expect(treePolicy(tree([name]))).toBe('refused');
  });

  it('keeps an ordinary column and a qualified one', () => {
    expect(treePolicy(tree(['id']))).toBe('ok');
    expect(treePolicy(tree(['t', 'current_schema']))).toBe('ok');
  });
});

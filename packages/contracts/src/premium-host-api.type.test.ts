/**
 * Type-level assertions for the plugin API 1.2.0 shapes. Vitest strips types, so each
 * `@ts-expect-error` below is enforced by `pnpm --filter @bombfarm/contracts typecheck`; an unused
 * directive is itself a `tsc` error, so a widened type fails the build rather than passing.
 */
import { describe, expect, it } from 'vitest';
import type { CapabilityReply, DbArgs, RawBattleLogItem, RawTapItem } from './premium-host.js';

describe('plugin API 1.2.0 — type-level assertions', () => {
  it('accepts every db op and a refusal that carries a reason', () => {
    const ops: DbArgs[] = [
      { op: 'exec', sql: 'DELETE FROM t' },
      { op: 'query', sql: 'SELECT $1', params: [1] },
      { op: 'batch', sql: 'INSERT INTO t VALUES ($1)', rows: [[1], [2]] },
      { op: 'tx', steps: [{ sql: 'DELETE FROM t' }] },
      { op: 'size' },
      { op: 'status' },
    ];
    const refusal: CapabilityReply = { id: 1, ok: false, error: 'failed', reason: 'disk_full' };
    expect(ops).toHaveLength(6);
    expect(refusal.ok).toBe(false);
  });

  it('rejects an unknown op', () => {
    // @ts-expect-error - 'truncate' is not one of the six db ops
    const bad: DbArgs = { op: 'truncate', sql: 'x' };
    expect(bad.op).toBe('truncate');
  });

  it('rejects a reason outside the pinned categories', () => {
    // @ts-expect-error - 'syntax_error' is not a refusal reason
    const bad: CapabilityReply = { id: 1, ok: false, error: 'bad_args', reason: 'syntax_error' };
    expect(bad.ok).toBe(false);
  });

  it('rejects a raw.tap item without seq or accountKey', () => {
    // @ts-expect-error - seq is required
    const noSeq: RawTapItem = { kind: 'body', atMs: 1, accountKey: '486', body: {} };
    // @ts-expect-error - accountKey is required
    const noKey: RawTapItem = { kind: 'frame', seq: 1, atMs: 1, wire: {} };
    expect([noSeq, noKey]).toHaveLength(2);
  });

  it('rejects a battle-log item without its baseline flag', () => {
    // @ts-expect-error - baseline is required
    const bad: RawBattleLogItem = {
      seq: 1,
      atMs: 1,
      accountKey: '486',
      section: 'acc_486',
      text: '',
      mtimeMs: 1,
      gameLanguage: null,
    };
    expect(bad.seq).toBe(1);
  });
});

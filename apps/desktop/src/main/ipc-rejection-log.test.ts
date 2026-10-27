import { describe, expect, it, vi } from 'vitest';
import {
  IPC_REJECTION_BURST,
  IPC_REJECTION_REFILL_MS,
  IPC_REJECTION_REPORT_MS,
  createIpcRejectionLogGate,
} from './ipc-rejection-log.js';

function gateAt(start = 5_000_000) {
  const clock = { ms: start };
  const warn = vi.fn();
  const scheduled: { callback: () => void; delayMs: number }[] = [];
  const gate = createIpcRejectionLogGate({
    now: () => clock.ms,
    warn,
    schedule: (callback, delayMs) => {
      scheduled.push({ callback, delayMs });
    },
  });
  return { gate, clock, warn, scheduled };
}

describe('createIpcRejectionLogGate', () => {
  it('admits a burst for one window and reason, then refuses the rest', () => {
    const { gate } = gateAt();
    const outcomes = Array.from({ length: IPC_REJECTION_BURST + 3 }, () => gate.admit('mini-live', 'channel_not_allowed'));
    expect(outcomes.filter(Boolean)).toHaveLength(IPC_REJECTION_BURST);
    expect(outcomes.slice(IPC_REJECTION_BURST)).toEqual([false, false, false]);
  });

  it('pins the allowance: ten at once, then one every ten seconds, reported after a minute', () => {
    expect([IPC_REJECTION_BURST, IPC_REJECTION_REFILL_MS, IPC_REJECTION_REPORT_MS]).toEqual([10, 10_000, 60_000]);
  });

  it('keeps a bucket per window and per reason', () => {
    const { gate } = gateAt();
    for (let i = 0; i < IPC_REJECTION_BURST * 2; i += 1) gate.admit('mini-live', 'channel_not_allowed');
    expect(gate.admit('main', 'channel_not_allowed')).toBe(true);
    expect(gate.admit('mini-live', 'untrusted_origin')).toBe(true);
    expect(gate.admit('mini-live', 'channel_not_allowed')).toBe(false);
  });

  it('bounds a sender with no window by its reason, under one key', () => {
    const { gate, scheduled } = gateAt();
    const admitted = Array.from({ length: 500 }, () => gate.admit(null, 'unknown_window')).filter(Boolean);
    expect(admitted).toHaveLength(IPC_REJECTION_BURST);
    expect(scheduled).toHaveLength(1);
  });

  it('refills one per interval on the clock it is given', () => {
    const { gate, clock } = gateAt();
    for (let i = 0; i < IPC_REJECTION_BURST; i += 1) gate.admit('main', 'detached_frame');
    expect(gate.admit('main', 'detached_frame')).toBe(false);
    clock.ms += IPC_REJECTION_REFILL_MS;
    expect(gate.admit('main', 'detached_frame')).toBe(true);
    expect(gate.admit('main', 'detached_frame')).toBe(false);
  });

  it('mints nothing when the clock steps back and returns', () => {
    const { gate, clock } = gateAt();
    const start = clock.ms;
    for (let i = 0; i < IPC_REJECTION_BURST; i += 1) gate.admit('main', 'detached_frame');
    for (let trip = 0; trip < 3; trip += 1) {
      clock.ms = start - 3_600_000;
      expect(gate.admit('main', 'detached_frame')).toBe(false);
      clock.ms = start;
      expect(gate.admit('main', 'detached_frame')).toBe(false);
    }
  });

  it('writes nothing, and schedules nothing, while every refusal is admitted', () => {
    const { gate, warn, scheduled } = gateAt();
    for (let i = 0; i < IPC_REJECTION_BURST; i += 1) gate.admit('main', 'no_frame');
    expect(warn).not.toHaveBeenCalled();
    expect(scheduled).toEqual([]);
  });

  it('reports the count of what it left out as one line per key, a minute after the first drop', () => {
    const { gate, warn, scheduled } = gateAt();
    for (let i = 0; i < IPC_REJECTION_BURST + 7; i += 1) gate.admit('mini-live', 'channel_not_allowed');
    for (let i = 0; i < IPC_REJECTION_BURST + 2; i += 1) gate.admit('main', 'untrusted_origin');

    expect(scheduled.map((entry) => entry.delayMs)).toEqual([IPC_REJECTION_REPORT_MS, IPC_REJECTION_REPORT_MS]);
    scheduled.forEach((entry) => {
      entry.callback();
    });
    expect(warn.mock.calls.map((call) => call[0] as unknown)).toEqual([
      { scope: 'main', event: 'ipc.sender_rejections_suppressed', window: 'mini-live', reason: 'channel_not_allowed', suppressed: 7 },
      { scope: 'main', event: 'ipc.sender_rejections_suppressed', window: 'main', reason: 'untrusted_origin', suppressed: 2 },
    ]);
  });

  it('starts counting afresh after a report', () => {
    const { gate, warn, scheduled } = gateAt();
    for (let i = 0; i < IPC_REJECTION_BURST + 3; i += 1) gate.admit('main', 'no_frame');
    scheduled[0]?.callback();
    expect(gate.admit('main', 'no_frame')).toBe(false);
    expect(scheduled).toHaveLength(2);
    scheduled[1]?.callback();
    expect(warn).toHaveBeenLastCalledWith(expect.objectContaining({ suppressed: 1 }));
  });

  it('runs on the monotonic clock when none is given, ignoring the wall clock', () => {
    const monotonic = vi.spyOn(performance, 'now').mockReturnValue(1_000);
    const wall = vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
    try {
      const gate = createIpcRejectionLogGate({ warn: vi.fn(), schedule: vi.fn() });
      for (let i = 0; i < IPC_REJECTION_BURST; i += 1) gate.admit('main', 'no_frame');
      wall.mockReturnValue(0);
      expect(gate.admit('main', 'no_frame')).toBe(false);
      wall.mockReturnValue(1_700_003_600_000);
      expect(gate.admit('main', 'no_frame')).toBe(false);
      monotonic.mockReturnValue(1_000 + IPC_REJECTION_REFILL_MS);
      expect(gate.admit('main', 'no_frame')).toBe(true);
    } finally {
      monotonic.mockRestore();
      wall.mockRestore();
    }
  });
});

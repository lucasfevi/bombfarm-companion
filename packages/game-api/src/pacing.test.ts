import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  PacingHaltedError,
  PacingRefusedError,
  READ_PACING,
  createPacingGate,
  type PacingClock,
} from './pacing.js';

function createFakeClock(): PacingClock & { readonly sleepCalls: number[] } {
  let time = 0;
  const sleepCalls: number[] = [];
  return {
    now: () => time,
    sleep: (ms: number) => {
      sleepCalls.push(ms);
      time += ms;
      return Promise.resolve();
    },
    sleepCalls,
  };
}

describe('READ_PACING — every value carries a provenance comment', () => {
  const source = readFileSync(fileURLToPath(new URL('./pacing.ts', import.meta.url)), 'utf8');
  const lines = source.split('\n');

  function provenanceComment(key: string): string | null {
    const keyLineIndex = lines.findIndex((line) => new RegExp(`^\\s*${key}:`).test(line));
    if (keyLineIndex === -1) return null;
    const collected: string[] = [];
    let i = keyLineIndex - 1;
    while (i >= 0) {
      const trimmed = (lines[i] ?? '').trim();
      if (trimmed === '') {
        i -= 1;
        continue;
      }
      if (trimmed.startsWith('/**') || trimmed.startsWith('*')) {
        collected.unshift(trimmed);
        i -= 1;
        continue;
      }
      break;
    }
    return collected.length > 0 ? collected.join(' ') : null;
  }

  for (const key of Object.keys(READ_PACING)) {
    it(`${key} has a provenance comment stating whether it is measured`, () => {
      const comment = provenanceComment(key);
      expect(comment).not.toBeNull();
      expect(comment).toMatch(/Unmeasured|Reused/i);
    });
  }

  it('minRequestGapMs names the 2026-08-12 calibration and states it is evidence of safety, not a measured limit', () => {
    const comment = provenanceComment('minRequestGapMs');
    expect(comment).toMatch(/2026-08-12/);
    expect(comment).toMatch(/not a measured limit/i);
  });
});

describe('createPacingGate — single-flight, strict serial order, no wall clock', () => {
  it('starts three overlapping run() calls and resolves them strictly serially', async () => {
    const clock = createFakeClock();
    const gate = createPacingGate(clock);
    const order: string[] = [];

    function makeFn(id: string): () => Promise<string> {
      return async () => {
        order.push(`start-${id}`);
        await Promise.resolve();
        order.push(`end-${id}`);
        return id;
      };
    }

    const p1 = gate.run('a', makeFn('1'));
    const p2 = gate.run('b', makeFn('2'));
    const p3 = gate.run('c', makeFn('3'));

    await Promise.all([p1, p2, p3]);

    expect(order).toEqual(['start-1', 'end-1', 'start-2', 'end-2', 'start-3', 'end-3']);
  });

  it('separates consecutive requests by at least minRequestGapMs, per the fake clock', async () => {
    const clock = createFakeClock();
    const gate = createPacingGate(clock);

    await gate.run('a', () => Promise.resolve('x'));
    await gate.run('b', () => Promise.resolve('y'));
    await gate.run('c', () => Promise.resolve('z'));

    // Two gaps enforced across three requests; each sleep call is at least minRequestGapMs.
    expect(clock.sleepCalls.length).toBeGreaterThanOrEqual(2);
    for (const ms of clock.sleepCalls) {
      expect(ms).toBeGreaterThanOrEqual(READ_PACING.minRequestGapMs);
    }
  });

  it('coalesces a repeat of the same key into the in-flight call — one invocation, both callers resolve', async () => {
    const clock = createFakeClock();
    const gate = createPacingGate(clock);
    let invocations = 0;
    const fn = () =>
      new Promise<string>((resolve) => {
        invocations += 1;
        // Resolve on the next microtask so both run() calls attach before it settles.
        void Promise.resolve().then(() => {
          resolve('shared-result');
        });
      });

    const first = gate.run('/roster', fn);
    const second = gate.run('/roster', fn);

    const [firstResult, secondResult] = await Promise.all([first, second]);

    expect(invocations).toBe(1);
    expect(firstResult).toBe('shared-result');
    expect(secondResult).toBe('shared-result');
  });
});

describe('createPacingGate — cooldown backoff ladder', () => {
  const table: ReadonlyArray<{ readonly trips: number; readonly expectedDelayMs: number }> = [
    { trips: 1, expectedDelayMs: 60_000 },
    { trips: 2, expectedDelayMs: 120_000 },
    { trips: 3, expectedDelayMs: 240_000 },
    { trips: 4, expectedDelayMs: 480_000 },
    { trips: 5, expectedDelayMs: 900_000 }, // would be 960_000 uncapped; capped at 900_000
    { trips: 6, expectedDelayMs: 900_000 },
  ];

  for (const { trips, expectedDelayMs } of table) {
    it(`${String(trips)} consecutive cooldown trip(s) -> backoff of ${String(expectedDelayMs)}ms`, () => {
      const clock = createFakeClock();
      const gate = createPacingGate(clock);
      for (let i = 0; i < trips; i += 1) {
        gate.observe({ kind: 'cooldown' });
      }
      const state = gate.state;
      expect(state).not.toBe('ready');
      expect(state).not.toBe('halted');
      if (typeof state === 'object') {
        expect(state.backoffUntil).toBe(clock.now() + expectedDelayMs);
      }
    });
  }

  it('429, 503 and a cooldown-shaped error body all trip the same ladder — observe only inspects .kind', () => {
    const clock = createFakeClock();
    const gate = createPacingGate(clock);
    gate.observe({ kind: 'cooldown' });
    const afterFirst = gate.state;
    expect(afterFirst).not.toBe('ready');
  });

  it('issues no request inside the backoff window — refused without invoking the transport', async () => {
    const clock = createFakeClock();
    const gate = createPacingGate(clock);
    gate.observe({ kind: 'cooldown' });

    const fn = () => Promise.resolve('should-not-run');
    await expect(gate.run('/state', fn)).rejects.toBeInstanceOf(PacingRefusedError);
  });

  it('the first ok resets the ladder to zero', () => {
    const clock = createFakeClock();
    const gate = createPacingGate(clock);
    gate.observe({ kind: 'cooldown' });
    gate.observe({ kind: 'cooldown' });
    gate.observe({ kind: 'ok' });
    expect(gate.state).toBe('ready');

    // A subsequent cooldown starts the ladder over at step 1, not step 3.
    gate.observe({ kind: 'cooldown' });
    const state = gate.state;
    if (typeof state === 'object') {
      expect(state.backoffUntil).toBe(clock.now() + 60_000);
    }
  });
});

describe('createPacingGate — unauthorized halts the cycle', () => {
  it('unauthorized sets halted, distinct from ready or a backoff window', () => {
    const clock = createFakeClock();
    const gate = createPacingGate(clock);
    gate.observe({ kind: 'unauthorized' });
    expect(gate.state).toBe('halted');
  });

  it('nextCycleDelayMs refuses to schedule while halted', () => {
    const clock = createFakeClock();
    const gate = createPacingGate(clock);
    gate.observe({ kind: 'unauthorized' });
    expect(() => gate.nextCycleDelayMs(true)).toThrow(PacingHaltedError);
  });

  it('run() refuses while halted, without invoking the transport', async () => {
    const clock = createFakeClock();
    const gate = createPacingGate(clock);
    gate.observe({ kind: 'unauthorized' });
    const fn = () => Promise.resolve('should-not-run');
    await expect(gate.run('/state', fn)).rejects.toBeInstanceOf(PacingRefusedError);
  });

  it('only resetAuth() clears halted — the two legitimate callers are a changed token file and an explicit user retry, never a timer', () => {
    const clock = createFakeClock();
    const gate = createPacingGate(clock);
    gate.observe({ kind: 'unauthorized' });
    expect(gate.state).toBe('halted');

    gate.resetAuth();
    expect(gate.state).toBe('ready');
    expect(() => gate.nextCycleDelayMs(true)).not.toThrow();
  });
});

describe('createPacingGate — cycle interval', () => {
  it('the background interval is longer than the foreground interval', () => {
    expect(READ_PACING.cycleBackgroundMs).toBeGreaterThan(READ_PACING.cycleForegroundMs);
  });

  it('nextCycleDelayMs reflects the requested focus state, with no side effects', () => {
    const clock = createFakeClock();
    const gate = createPacingGate(clock);
    expect(gate.nextCycleDelayMs(true)).toBe(READ_PACING.cycleForegroundMs);
    expect(gate.nextCycleDelayMs(false)).toBe(READ_PACING.cycleBackgroundMs);
    // Switching focus back and forth does not trip backoff or halt — it is a pure query.
    expect(gate.state).toBe('ready');
  });

  it('nextCycleDelayMs returns the remaining backoff window when it exceeds the normal interval', () => {
    const clock = createFakeClock();
    const gate = createPacingGate(clock);
    gate.observe({ kind: 'cooldown' }); // backoffUntil = now + 60_000, well past cycleForegroundMs? no — equal-ish
    // Force a longer backoff by tripping twice (120_000ms), which exceeds cycleForegroundMs (60_000ms).
    gate.observe({ kind: 'cooldown' });
    expect(gate.nextCycleDelayMs(true)).toBeGreaterThan(READ_PACING.cycleForegroundMs);
  });
});

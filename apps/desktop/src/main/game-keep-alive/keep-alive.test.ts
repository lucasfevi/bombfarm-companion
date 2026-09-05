import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ABSENT_DEBOUNCE_MS,
  BACKOFF_MS,
  LAUNCH_WAIT_MS,
  POLL_INTERVAL_MS,
  applyEnabledChange,
  createInitialKeepAliveState,
  recordAskFailure,
  tickKeepAlive,
  type KeepAliveState,
} from './keep-alive.js';

function seenAndAbsentSince(absentSinceMs: number, overrides: Partial<KeepAliveState> = {}): KeepAliveState {
  return {
    ...createInitialKeepAliveState(),
    seenThisProcess: true,
    enabled: true,
    absentSinceMs,
    ...overrides,
  };
}

function askAt(nowMs: number): KeepAliveState {
  const armed = seenAndAbsentSince(nowMs - ABSENT_DEBOUNCE_MS);
  const asked = tickKeepAlive(armed, { nowMs, enabled: true, processPresent: false });
  expect(asked.action).toBe('ask-steam');
  return asked.state;
}

describe('constants', () => {
  it('debounces absence for 10s, waits 90s for a launch, and polls every 5s', () => {
    expect(ABSENT_DEBOUNCE_MS).toBe(10_000);
    expect(LAUNCH_WAIT_MS).toBe(90_000);
    expect(POLL_INTERVAL_MS).toBe(5_000);
  });

  it('climbs 30s, 60s, 2min, 5min, 10min', () => {
    expect(BACKOFF_MS).toEqual([30_000, 60_000, 120_000, 300_000, 600_000]);
  });
});

describe('createInitialKeepAliveState', () => {
  it('has seen nothing, is disabled, and holds no absence, ask or backoff', () => {
    expect(createInitialKeepAliveState()).toEqual({
      seenThisProcess: false,
      enabled: false,
      absentSinceMs: null,
      inFlightSinceMs: null,
      backoffUntilMs: 0,
      backoffStep: 0,
    });
  });
});

describe('a process this session never saw cannot have crashed', () => {
  it('never asks, however long it stays away and however long the switch has been on', () => {
    let state: KeepAliveState = { ...createInitialKeepAliveState(), enabled: true };

    for (let nowMs = 0; nowMs <= 30 * 60_000; nowMs += POLL_INTERVAL_MS) {
      const result = tickKeepAlive(state, { nowMs, enabled: true, processPresent: false });
      expect(result.action).toBe('none');
      state = result.state;
    }

    expect(state.inFlightSinceMs).toBeNull();
    expect(state.backoffStep).toBe(0);
  });

  it('the first tick after the companion opens with the game already closed asks nothing', () => {
    const result = tickKeepAlive(createInitialKeepAliveState(), {
      nowMs: 1_700_000_000_000,
      enabled: true,
      processPresent: false,
    });

    expect(result.action).toBe('none');
    expect(result.state.seenThisProcess).toBe(false);
    expect(result.state.absentSinceMs).toBe(1_700_000_000_000);
  });
});

describe('a present process', () => {
  it('is recorded as seen and asks nothing', () => {
    const result = tickKeepAlive(createInitialKeepAliveState(), { nowMs: 1_000, enabled: true, processPresent: true });

    expect(result.action).toBe('none');
    expect(result.state.seenThisProcess).toBe(true);
    expect(result.state.absentSinceMs).toBeNull();
  });

  it('appearing while an ask is in flight is that ask succeeding — the ladder resets', () => {
    const inFlight = seenAndAbsentSince(0, { inFlightSinceMs: 40_000, backoffStep: 3, backoffUntilMs: 999_999 });

    const result = tickKeepAlive(inFlight, { nowMs: 60_000, enabled: true, processPresent: true });

    expect(result.action).toBe('none');
    expect(result.state.inFlightSinceMs).toBeNull();
    expect(result.state.backoffStep).toBe(0);
    expect(result.state.backoffUntilMs).toBe(0);
  });
});

describe('asking Steam', () => {
  it('asks once when the switch is on, the game was seen, it has been gone 10s and no backoff is owed', () => {
    const state = seenAndAbsentSince(100_000);

    const result = tickKeepAlive(state, { nowMs: 110_000, enabled: true, processPresent: false });

    expect(result.action).toBe('ask-steam');
    expect(result.state.inFlightSinceMs).toBe(110_000);
  });

  it('waits out the debounce to the millisecond', () => {
    const state = seenAndAbsentSince(0);

    expect(tickKeepAlive(state, { nowMs: 9_999, enabled: true, processPresent: false }).action).toBe('none');
    expect(tickKeepAlive(state, { nowMs: 10_000, enabled: true, processPresent: false }).action).toBe('ask-steam');
  });

  it('does not ask twice while one ask is still waiting for the process to appear', () => {
    const asked = askAt(110_000);

    const second = tickKeepAlive(asked, { nowMs: 115_000, enabled: true, processPresent: false });
    const third = tickKeepAlive(second.state, { nowMs: 199_000, enabled: true, processPresent: false });

    expect(second.action).toBe('none');
    expect(third.action).toBe('none');
    expect(third.state.inFlightSinceMs).toBe(110_000);
  });

  it('honours an armed backoff and asks again once it elapses', () => {
    const owed = seenAndAbsentSince(0, { backoffUntilMs: 200_000, backoffStep: 1 });

    expect(tickKeepAlive(owed, { nowMs: 199_999, enabled: true, processPresent: false }).action).toBe('none');
    expect(tickKeepAlive(owed, { nowMs: 200_000, enabled: true, processPresent: false }).action).toBe('ask-steam');
  });
});

describe('an ask that never brought the game back', () => {
  it('gives up after the launch wait and arms the first ladder step', () => {
    const asked = askAt(110_000);

    const stillWaiting = tickKeepAlive(asked, { nowMs: 110_000 + LAUNCH_WAIT_MS - 1, enabled: true, processPresent: false });
    expect(stillWaiting.action).toBe('none');
    expect(stillWaiting.state.inFlightSinceMs).toBe(110_000);

    const failed = tickKeepAlive(asked, { nowMs: 110_000 + LAUNCH_WAIT_MS, enabled: true, processPresent: false });
    expect(failed.action).toBe('none');
    expect(failed.state.inFlightSinceMs).toBeNull();
    expect(failed.state.backoffUntilMs).toBe(110_000 + LAUNCH_WAIT_MS + 30_000);
    expect(failed.state.backoffStep).toBe(1);
  });

  it('climbs the ladder over successive failures and stays at 10 minutes', () => {
    let state = seenAndAbsentSince(0);
    let nowMs = ABSENT_DEBOUNCE_MS;
    const armedDelays: number[] = [];

    for (let attempt = 0; attempt < 7; attempt += 1) {
      const asked = tickKeepAlive(state, { nowMs, enabled: true, processPresent: false });
      expect(asked.action).toBe('ask-steam');

      nowMs += LAUNCH_WAIT_MS;
      const failed = tickKeepAlive(asked.state, { nowMs, enabled: true, processPresent: false });
      armedDelays.push(failed.state.backoffUntilMs - nowMs);

      state = failed.state;
      nowMs = failed.state.backoffUntilMs;
    }

    expect(armedDelays).toEqual([30_000, 60_000, 120_000, 300_000, 600_000, 600_000, 600_000]);
  });

  it('an ask that worked resets the ladder, so the next crash waits 30s again', () => {
    let state = seenAndAbsentSince(0);
    let nowMs = ABSENT_DEBOUNCE_MS;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const asked = tickKeepAlive(state, { nowMs, enabled: true, processPresent: false });
      nowMs += LAUNCH_WAIT_MS;
      const failed = tickKeepAlive(asked.state, { nowMs, enabled: true, processPresent: false });
      state = failed.state;
      nowMs = failed.state.backoffUntilMs;
    }
    expect(state.backoffStep).toBe(3);

    const asked = tickKeepAlive(state, { nowMs, enabled: true, processPresent: false });
    expect(asked.action).toBe('ask-steam');
    nowMs += 20_000;
    const appeared = tickKeepAlive(asked.state, { nowMs, enabled: true, processPresent: true });
    expect(appeared.state.backoffStep).toBe(0);

    nowMs += 60_000;
    const goneAgain = tickKeepAlive(appeared.state, { nowMs, enabled: true, processPresent: false });
    nowMs += ABSENT_DEBOUNCE_MS;
    const askedAgain = tickKeepAlive(goneAgain.state, { nowMs, enabled: true, processPresent: false });
    expect(askedAgain.action).toBe('ask-steam');

    nowMs += LAUNCH_WAIT_MS;
    const failedAgain = tickKeepAlive(askedAgain.state, { nowMs, enabled: true, processPresent: false });
    expect(failedAgain.state.backoffUntilMs - nowMs).toBe(30_000);
  });
});

describe('the switch off', () => {
  it('never asks, whatever the rest of the state says', () => {
    const states: KeepAliveState[] = [
      createInitialKeepAliveState(),
      seenAndAbsentSince(0, { enabled: false }),
      seenAndAbsentSince(0, { enabled: false, backoffUntilMs: 0, backoffStep: 4 }),
      seenAndAbsentSince(0, { enabled: false, inFlightSinceMs: 1_000 }),
      { ...createInitialKeepAliveState(), seenThisProcess: true, absentSinceMs: 0 },
    ];

    for (const state of states) {
      for (const nowMs of [0, 10_000, 100_000, 1_000_000]) {
        expect(tickKeepAlive(state, { nowMs, enabled: false, processPresent: false }).action).toBe('none');
      }
    }
  });

  it('tracks when the game went away even while off, so turning it on later has a start point', () => {
    const seen = tickKeepAlive(createInitialKeepAliveState(), { nowMs: 0, enabled: false, processPresent: true });
    const gone = tickKeepAlive(seen.state, { nowMs: 5_000, enabled: false, processPresent: false });

    expect(gone.state.absentSinceMs).toBe(5_000);
  });

  it('an ask already in flight still finishes waiting, and nothing follows it', () => {
    const asked = askAt(110_000);

    const failed = tickKeepAlive(asked, { nowMs: 110_000 + LAUNCH_WAIT_MS, enabled: false, processPresent: false });
    expect(failed.action).toBe('none');
    expect(failed.state.inFlightSinceMs).toBeNull();

    let state = failed.state;
    for (let nowMs = 200_000; nowMs <= 2_000_000; nowMs += 60_000) {
      const result = tickKeepAlive(state, { nowMs, enabled: false, processPresent: false });
      expect(result.action).toBe('none');
      state = result.state;
    }
  });
});

describe('applyEnabledChange', () => {
  it('restarts the debounce from the switch when it is turned on over an already-absent game', () => {
    const state = seenAndAbsentSince(1_000, { enabled: false });

    const next = applyEnabledChange(state, true, 500_000);

    expect(next.enabled).toBe(true);
    expect(next.absentSinceMs).toBe(500_000);
    expect(tickKeepAlive(next, { nowMs: 509_999, enabled: true, processPresent: false }).action).toBe('none');
    expect(tickKeepAlive(next, { nowMs: 510_000, enabled: true, processPresent: false }).action).toBe('ask-steam');
  });

  it('leaves the absence start alone when the game is present, or when the switch was already on', () => {
    const present = { ...createInitialKeepAliveState(), seenThisProcess: true };
    expect(applyEnabledChange(present, true, 500_000).absentSinceMs).toBeNull();

    const alreadyOn = seenAndAbsentSince(1_000);
    expect(applyEnabledChange(alreadyOn, true, 500_000).absentSinceMs).toBe(1_000);
  });

  it('turning it off keeps the ladder where it was', () => {
    const climbed = seenAndAbsentSince(0, { backoffStep: 3, backoffUntilMs: 900_000 });

    const next = applyEnabledChange(climbed, false, 500_000);

    expect(next.enabled).toBe(false);
    expect(next.backoffStep).toBe(3);
    expect(next.backoffUntilMs).toBe(900_000);
  });
});

describe('recordAskFailure', () => {
  it('arms the next ladder step immediately, without spending the launch wait', () => {
    const asked = askAt(110_000);

    const refused = recordAskFailure(asked, 110_050);

    expect(refused.inFlightSinceMs).toBeNull();
    expect(refused.backoffUntilMs).toBe(110_050 + 30_000);
    expect(refused.backoffStep).toBe(1);
    expect(tickKeepAlive(refused, { nowMs: 120_000, enabled: true, processPresent: false }).action).toBe('none');
  });

  it('climbs and caps the same ladder the launch-wait failure uses', () => {
    let state = seenAndAbsentSince(0);
    const armedDelays: number[] = [];

    for (let attempt = 0; attempt < 6; attempt += 1) {
      state = recordAskFailure(state, 1_000);
      armedDelays.push(state.backoffUntilMs - 1_000);
    }

    expect(armedDelays).toEqual([30_000, 60_000, 120_000, 300_000, 600_000, 600_000]);
  });
});

describe('the source itself', () => {
  const source = readFileSync(join(__dirname, 'keep-alive.ts'), 'utf8');

  it('has no way to stop a game, because stopping one is not part of this', () => {
    expect(source).not.toMatch(/taskkill/i);
    expect(source).not.toMatch(/process\.kill/);
  });

  it('imports nothing, so no clock, no filesystem and no game reader can reach the decision', () => {
    expect(source).not.toMatch(/^\s*import\s/m);
    expect(source).not.toMatch(/require\(/);
    expect(source).not.toMatch(/Date\.now/);
  });
});

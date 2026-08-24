import type { AccountView, LiveCurrency, LiveEvent, LiveFrame, LiveTick } from '@bombfarm/contracts';
import { liveGap } from '@bombfarm/contracts';
import { wireKey } from '@bombfarm/game-api';
import { describe, expect, it } from 'vitest';
import { generateReplayStream } from './fixtures/generate-replay-stream.js';
import { LiveSource, type TapHandle } from './live-source.js';

class FakeTap implements TapHandle {
  startCount = 0;
  teardownCount = 0;
  pollNowCount = 0;

  constructor(private readonly onEvent: (event: LiveEvent) => void) {}

  start(): void {
    this.startCount += 1;
  }

  teardown(): Promise<void> {
    this.teardownCount += 1;
    return Promise.resolve();
  }

  pollNow(): void {
    this.pollNowCount += 1;
  }

  emit(event: LiveEvent): void {
    this.onEvent(event);
  }
}

function createHarness() {
  const taps: FakeTap[] = [];
  let sequence = 0;
  const clock = { ms: 1_700_000_000_000 };

  const source = new LiveSource({
    consent: () => true,
    userDataDir: 'unused-in-tests',
    now: () => clock.ms,
    createTap: (onEvent) => {
      const tap = new FakeTap(onEvent);
      taps.push(tap);
      return tap;
    },
  });

  function currentTap(): FakeTap {
    const tap = taps[taps.length - 1];
    if (!tap) throw new Error('harness: no tap constructed yet');
    return tap;
  }

  function pushFrame(tick: LiveTick): LiveFrame {
    sequence += 1;
    clock.ms += 100;
    const frame: LiveFrame = { at: new Date(clock.ms).toISOString(), sequence, tick };
    currentTap().emit({ type: 'frame', frame });
    return frame;
  }

  function pushCurrency(currency: LiveCurrency): void {
    currentTap().emit({ type: 'currency', currency });
  }

  function goLive(): void {
    pushCurrency({ kind: 'live', lastFrameAt: new Date(clock.ms).toISOString(), sinceAt: new Date(clock.ms).toISOString() });
  }

  return { source, taps, currentTap, pushFrame, pushCurrency, goLive, clock };
}

function buildRotationBody(opts: {
  readonly fieldHeroId: string;
  readonly fieldEnergyFraction: number;
  readonly fieldEnergyMax: number;
  readonly restingHeroId: string;
  readonly restingEnergyFraction: number;
  readonly cycleSeconds: number;
}): Record<string, unknown> {
  return {
    [wireKey('fieldSize')]: 3,
    [wireKey('heroesList')]: [
      {
        [wireKey('heroId')]: opts.fieldHeroId,
        [wireKey('heroEnergy')]: opts.fieldEnergyFraction * opts.fieldEnergyMax,
        [wireKey('heroEnergyMax')]: opts.fieldEnergyMax,
        [wireKey('heroEnergyFraction')]: opts.fieldEnergyFraction,
        [wireKey('heroState')]: 'EM_CAMPO',
        [wireKey('heroOnField')]: true,
        [wireKey('heroInHouse')]: false,
      },
      {
        [wireKey('heroId')]: opts.restingHeroId,
        [wireKey('heroEnergyFraction')]: opts.restingEnergyFraction,
        [wireKey('heroState')]: 'DESCANSANDO',
        [wireKey('heroOnField')]: false,
        [wireKey('heroInHouse')]: true,
        [wireKey('heroRecovering')]: true,
      },
    ],
    [wireKey('house')]: {
      [wireKey('houseActive')]: 1,
      [wireKey('houseLevels')]: [1, 2, 3],
      [wireKey('houseCycleSeconds')]: opts.cycleSeconds,
      [wireKey('houseSlots')]: 3,
    },
    [wireKey('rescuesLeft')]: 2,
    [wireKey('rescuesMax')]: 2,
  };
}

function buildAccountView(casa: Record<string, unknown>): AccountView {
  return {
    payload: { casa, heroes: [] },
    gameRunning: true,
    store: { status: 'ok', reason: null, binding: 'sqlite' },
  };
}

describe('LiveSource: driven live from a replayed frame sequence', () => {
  it('reaches a live currency with populated field countdowns', () => {
    const { source, pushFrame, goLive } = createHarness();
    source.start();

    const stream = generateReplayStream();
    goLive();
    for (const frame of stream.frames.slice(6, 12)) pushFrame(frame.tick);

    const view = source.getView();
    expect(view.currency.kind).toBe('live');
    expect(view.field.length).toBeGreaterThan(0);
  });
});

describe('LiveSource: gap reasons', () => {
  it('an idle client is a non-actionable gap', () => {
    const { source, pushCurrency } = createHarness();
    source.start();

    pushCurrency(liveGap('clientNotStreaming', new Date().toISOString()));

    const view = source.getView();
    expect(view.currency).toMatchObject({ kind: 'gap', reason: 'clientNotStreaming', actionable: false });
  });

  it('a hook that has gone silent is an actionable gap', () => {
    const { source, pushCurrency } = createHarness();
    source.start();

    pushCurrency(liveGap('hookSilent', new Date().toISOString()));

    const view = source.getView();
    expect(view.currency).toMatchObject({ kind: 'gap', reason: 'hookSilent', actionable: true });
  });
});

describe('LiveSource: fan-out to multiple consumers', () => {
  it('delivers the full burst to every listener, and a throwing listener does not starve the other', () => {
    const { source, pushFrame, goLive } = createHarness();
    source.start();

    const seenByGood: LiveEvent[] = [];
    const seenByThrowing: LiveEvent[] = [];
    source.subscribe((event) => {
      seenByThrowing.push(event);
      throw new Error('boom');
    });
    source.subscribe((event) => {
      seenByGood.push(event);
    });

    const stream = generateReplayStream();
    goLive();
    for (const frame of stream.frames.slice(6, 11)) pushFrame(frame.tick);

    expect(seenByGood).toHaveLength(6); // one currency event, five frames
    expect(seenByThrowing).toHaveLength(seenByGood.length);
    expect(seenByThrowing).toEqual(seenByGood);
  });
});

describe('LiveSource: composition with the REST rotation projection', () => {
  it('attach disabled: serves REST data, not-live, with every countdown modelled', () => {
    const { source } = createHarness();
    source.start();

    const body = buildRotationBody({
      fieldHeroId: 'hero-field',
      fieldEnergyFraction: 0.8,
      fieldEnergyMax: 100,
      restingHeroId: 'hero-resting',
      restingEnergyFraction: 0.3,
      cycleSeconds: 600,
    });
    source.ingestRotation(buildAccountView(body));

    const view = source.getView();
    expect(view.currency.kind).toBe('gap');
    expect(view.rotation).not.toBeNull();
    expect(view.field).toHaveLength(1);
    expect(view.field[0]).toMatchObject({ heroId: 'hero-field', basis: 'modelled' });
    expect(view.field[0]?.secondsRemaining).toBeGreaterThan(0);
    expect(view.recovery).toHaveLength(1);
    expect(view.recovery[0]).toMatchObject({ heroId: 'hero-resting', advancing: false });
  });

  it('enabling mid-run transitions the same object to live, without a restart', () => {
    const { source, pushFrame, goLive } = createHarness();
    source.start();

    const body = buildRotationBody({
      fieldHeroId: 'hero-field',
      fieldEnergyFraction: 0.8,
      fieldEnergyMax: 100,
      restingHeroId: 'hero-resting',
      restingEnergyFraction: 0.3,
      cycleSeconds: 600,
    });
    source.ingestRotation(buildAccountView(body));
    expect(source.getView().currency.kind).toBe('gap');

    const stream = generateReplayStream();
    goLive();
    for (const frame of stream.frames.slice(6, 9)) pushFrame(frame.tick);

    const view = source.getView();
    expect(view.currency.kind).toBe('live');
    expect(view.recovery.some((entry) => entry.advancing)).toBe(true);
  });
});

describe('LiveSource: REST refreshes must never earn an observed basis', () => {
  it('a dozen REST-only refreshes, draining linearly the whole time, stay modelled — with no tap ever attached', () => {
    const { source, clock } = createHarness();
    source.start();

    const energyMax = 1000;
    const ratePerSecond = 0.8;
    let energyFraction = 0.9;
    const observedBases: string[] = [];
    // Spacing is inside the drain-fit's own 30s sample-age window (unlike the real ~60s refresh
    // cadence), so a dozen calls actually accumulate enough samples to reach the observed-slope
    // gates — otherwise the age window alone would keep every countdown modelled and this test
    // would pass whether or not REST provenance were respected.
    const refreshIntervalMs = 3_000;

    for (let i = 0; i < 14; i += 1) {
      const body = buildRotationBody({
        fieldHeroId: 'hero-field',
        fieldEnergyFraction: energyFraction,
        fieldEnergyMax: energyMax,
        restingHeroId: 'hero-resting',
        restingEnergyFraction: 0.3,
        cycleSeconds: 600,
      });
      source.ingestRotation(buildAccountView(body));

      const view = source.getView();
      expect(view.currency.kind).toBe('gap');
      for (const countdown of view.field) observedBases.push(countdown.basis);

      clock.ms += refreshIntervalMs;
      energyFraction -= (ratePerSecond * (refreshIntervalMs / 1000)) / energyMax;
    }

    expect(observedBases.length).toBeGreaterThanOrEqual(14);
    expect(observedBases.every((basis) => basis === 'modelled')).toBe(true);
    expect(observedBases).not.toContain('observed');
  });
});

describe('LiveSource: consent revoke forces the tap down', () => {
  it('forceDetach tears the current tap down and starts a fresh one', async () => {
    const { source, taps } = createHarness();
    source.start();
    const first = taps[0];
    if (!first) throw new Error('harness: expected a tap to have been constructed on start()');

    await source.forceDetach();

    expect(first.teardownCount).toBe(1);
    expect(taps).toHaveLength(2);
    const second = taps[1];
    if (!second) throw new Error('harness: expected a replacement tap after forceDetach()');
    expect(second.startCount).toBe(1);
  });
});

describe('LiveSource: pollNow forwards to the current tap', () => {
  it('nudges the active tap rather than waiting on its own poll interval', () => {
    const { source, currentTap } = createHarness();
    source.start();

    source.pollNow();

    expect(currentTap().pollNowCount).toBe(1);
  });
});

describe('LiveSource: no raw payload on the seam', () => {
  it('a published frame event carries only the decoded tick, never a raw string', () => {
    const { source, pushFrame, goLive } = createHarness();
    source.start();

    const received: LiveEvent[] = [];
    source.subscribe((event) => received.push(event));

    const stream = generateReplayStream();
    goLive();
    const [combatFrame] = stream.frames.slice(6, 7);
    if (!combatFrame) throw new Error('fixture missing expected combat frame');
    pushFrame(combatFrame.tick);

    const frameEvent = received.find((event) => event.type === 'frame');
    expect(frameEvent).toBeDefined();
    if (frameEvent?.type !== 'frame') throw new Error('expected a frame event');
    expect(Object.keys(frameEvent.frame).sort()).toEqual(['at', 'sequence', 'tick']);
    expect(frameEvent.frame.tick).toEqual(combatFrame.tick);
    expect(JSON.stringify(frameEvent)).not.toMatch(/"raw"|"json"|"payload"/);
  });
});

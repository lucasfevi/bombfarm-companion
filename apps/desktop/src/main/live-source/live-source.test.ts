import type { AccountView, LiveCurrency, LiveEvent, LiveFrame, LiveTick } from '@bombfarm/contracts';
import { liveGap } from '@bombfarm/contracts';
import { wireKey } from '@bombfarm/game-api';
import { describe, expect, it } from 'vitest';
import { createBoundaryLog } from '../boundary-log/index.js';
import { generateReplayStream } from './fixtures/generate-replay-stream.js';
import type { LogPort } from './log-port.js';
import { LiveSource, type TapHandle } from './live-source.js';

class FakeTap implements TapHandle {
  startCount = 0;
  teardownCount = 0;
  pollNowCount = 0;

  constructor(
    private readonly onEvent: (event: LiveEvent) => void,
    private readonly onHttpBody: (body: Buffer, atMs: number) => void,
  ) {}

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

  emitHttpBody(body: unknown, atMs: number): void {
    this.onHttpBody(Buffer.from(JSON.stringify(body), 'utf8'), atMs);
  }

  emitRawHttpBody(bytes: Buffer, atMs: number): void {
    this.onHttpBody(bytes, atMs);
  }
}

function createHarness(opts: { readonly log?: LogPort } = {}) {
  const taps: FakeTap[] = [];
  let sequence = 0;
  const clock = { ms: 1_700_000_000_000 };

  const source = new LiveSource({
    consent: () => true,
    userDataDir: 'unused-in-tests',
    now: () => clock.ms,
    ...(opts.log ? { log: opts.log } : {}),
    createTap: (onEvent, onHttpBody) => {
      const tap = new FakeTap(onEvent, onHttpBody);
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

/** The smallest per-hero shape `parseAccountPayload` accepts without rejecting the whole read —
 *  see `hasUsableBirthStats` (`packages/domain/src/save-units.ts`). No ability ranks, so every
 *  hero built with this resolves the drain law's unreduced base rate — the same rate the fixed
 *  fallback this file's tests were already written against used to hardcode. */
const MINIMAL_BIRTH_STATS = {
  dmg: 1, energia: 1, speed: 1, crit_chance: 0, crit_dmg: 1, penetration: 0, cooldown_reduction: 0, luck: 0,
};

function minimalRosterHero(id: string): Record<string, unknown> {
  return { id, name: id, birth_stats: MINIMAL_BIRTH_STATS, stats: { ...MINIMAL_BIRTH_STATS }, abilities: [] };
}

function heroIdsFromCasaBody(casa: Record<string, unknown>): string[] {
  const heroesList = casa[wireKey('heroesList')];
  if (!Array.isArray(heroesList)) return [];
  return heroesList
    .map((hero) => (hero as Record<string, unknown>)[wireKey('heroId')])
    .filter((id): id is string => typeof id === 'string');
}

/** Every hero named in `casa`'s own `heroesList` also gets a minimal roster record, so the
 *  multipliers `LiveSource` resolves for them are never merely absent — matching a real account,
 *  where a rotation body and its roster describe the same heroes. */
function buildAccountView(casa: Record<string, unknown>): AccountView {
  return {
    payload: { casa, heroes: heroIdsFromCasaBody(casa).map(minimalRosterHero) },
    gameRunning: true,
    store: { status: 'ok', reason: null, binding: 'sqlite' },
  };
}

/** Every validated field present except whatever `extra` overrides, so a test can isolate exactly
 *  one drop per hero instead of also tripping over the fields it does not care about. This also
 *  happens to be the complete `ROTATION_HERO_LEVEL` key set (`packages/game-api/src/fingerprints.ts`)
 *  — the same shape a real `/rotation` body carries — which is what makes {@link bodyWithHeroes}
 *  usable for `identifyObservedBody`-driven tests, not only for `normalizeRotation` ones. */
function completeHero(id: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    [wireKey('heroId')]: id,
    [wireKey('heroLevel')]: 10,
    [wireKey('heroEnergy')]: 40,
    [wireKey('heroEnergyMax')]: 100,
    [wireKey('heroEnergyFraction')]: 0.4,
    [wireKey('heroState')]: 'EM_CAMPO',
    [wireKey('heroOnField')]: true,
    [wireKey('heroInHouse')]: false,
    [wireKey('heroRecovering')]: false,
    [wireKey('heroBattleAllowed')]: true,
    ...extra,
  };
}

/** The complete `/rotation` route shape (`packages/game-api/src/fingerprints.ts`'s `ROTATION_LEVEL`
 *  + `CASA_LEVEL`), not `buildRotationBody`'s simplified one — a body built with this is what
 *  `identifyObservedBody` recognises as the `casa` route. */
function bodyWithHeroes(heroes: readonly Record<string, unknown>[]): Record<string, unknown> {
  return {
    [wireKey('fieldSize')]: heroes.length,
    [wireKey('heroesList')]: heroes,
    [wireKey('house')]: {
      [wireKey('houseActive')]: 1,
      [wireKey('houseLevels')]: [1],
      [wireKey('houseCycleSeconds')]: 600,
      [wireKey('houseSlots')]: heroes.length,
      [wireKey('houseSlotsPerHouse')]: [heroes.length],
      [wireKey('houseCycleSecondsPerHouse')]: [600],
      [wireKey('houseUpgradeCost')]: [0],
    },
    [wireKey('rescuesLeft')]: 2,
    [wireKey('rescuesMax')]: 2,
  };
}

describe('LiveSource: driven live from a replayed frame sequence', () => {
  it('reaches a live currency with populated field countdowns', () => {
    const { source, pushFrame, goLive } = createHarness();
    source.start();

    const stream = generateReplayStream();
    const [firstCombatFrame] = stream.frames.slice(6, 12);
    if (!firstCombatFrame) throw new Error('fixture missing expected combat frame');
    const combatHeroIds = firstCombatFrame.tick.heroes.map((hero) => hero.id);
    source.ingestRotation(buildAccountView(bodyWithHeroes(combatHeroIds.map((id) => completeHero(id)))));

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

describe('LiveSource: rotation field drops are deduplicated and lose their hero index', () => {
  function heroMissingEnergyMax(id: string): Record<string, unknown> {
    const { [wireKey('heroEnergyMax')]: _omitted, ...rest } = completeHero(id);
    return rest;
  }

  /** Wires `LiveSource` to a real {@link createBoundaryLog} instance, the same shared-log shape
   *  production threads in — a bare spy `LogPort` would record every call unfiltered and this
   *  suite's whole point is proving the dedup collapse actually happens on the real path. */
  function harnessWithWarnSpy() {
    const warnRecords: Record<string, unknown>[] = [];
    const boundaryLog = createBoundaryLog({
      transport: {
        info: () => undefined,
        warn: (record) => warnRecords.push(record),
        error: () => undefined,
        debug: () => undefined,
      },
      now: () => Date.now(),
    });
    const source = new LiveSource({
      consent: () => true,
      userDataDir: 'unused-in-tests',
      createTap: (onEvent, onHttpBody) => new FakeTap(onEvent, onHttpBody),
      log: boundaryLog,
    });
    return { source, warnRecords };
  }

  function fieldDropWarnings(warnRecords: readonly Record<string, unknown>[]): Record<string, unknown>[] {
    return warnRecords.filter((record) => record.event === 'rotation.field_dropped');
  }

  it('eight heroes missing the same field collapse into exactly one line, path index normalised away', () => {
    const { source, warnRecords } = harnessWithWarnSpy();
    source.start();

    const heroIds = Array.from({ length: 8 }, (_, i) => `hero-${String(i)}`);
    source.ingestRotation(buildAccountView(bodyWithHeroes(heroIds.map(heroMissingEnergyMax))));

    const drops = fieldDropWarnings(warnRecords);
    expect(drops).toHaveLength(1);
    expect(drops[0]).toMatchObject({ path: 'heroes[].energia_max', reason: 'missing' });
  });

  it('drops on two different field paths stay distinct', () => {
    const { source, warnRecords } = harnessWithWarnSpy();
    source.start();

    const heroWrongTypeLevel = completeHero('hero-level', { [wireKey('heroLevel')]: 'not-a-number' });
    source.ingestRotation(
      buildAccountView(bodyWithHeroes([heroMissingEnergyMax('hero-energy'), heroWrongTypeLevel])),
    );

    const drops = fieldDropWarnings(warnRecords);
    expect(drops).toHaveLength(2);
    expect(drops.map((drop) => drop.path).sort()).toEqual(['heroes[].energia_max', 'heroes[].level']);
  });

  it('drops on the same field path but different reasons stay distinct', () => {
    const { source, warnRecords } = harnessWithWarnSpy();
    source.start();

    const heroWrongTypeLevel = completeHero('hero-wrong-type', { [wireKey('heroLevel')]: 'not-a-number' });
    const { [wireKey('heroLevel')]: _omitted, ...heroMissingLevel } = completeHero('hero-missing-level');
    source.ingestRotation(buildAccountView(bodyWithHeroes([heroWrongTypeLevel, heroMissingLevel])));

    const drops = fieldDropWarnings(warnRecords);
    expect(drops).toHaveLength(2);
    expect(drops.every((drop) => drop.path === 'heroes[].level')).toBe(true);
    expect(drops.map((drop) => drop.reason).sort()).toEqual(['missing', 'wrong_type']);
  });
});

describe('LiveSource: onFieldHeroIds tracks the live tap within one frame', () => {
  it('a hero the very next frame stops naming is off the on-field list on that same read, no cycle wait', () => {
    const { source, pushFrame, goLive } = createHarness();
    source.start();
    goLive();

    pushFrame({ heroes: [{ id: 'h1' }, { id: 'h2' }] });
    expect(source.getView().onFieldHeroIds).toEqual(['h1', 'h2']);

    pushFrame({ heroes: [{ id: 'h1' }] });
    expect(source.getView().onFieldHeroIds).toEqual(['h1']);
  });

  it('getView() returns the same onFieldHeroIds array reference across calls when membership has not changed, rather than sorting a fresh one every time', () => {
    const { source, pushFrame, goLive } = createHarness();
    source.start();
    goLive();
    pushFrame({ heroes: [{ id: 'h1' }, { id: 'h2' }] });

    const first = source.getView().onFieldHeroIds;
    const second = source.getView().onFieldHeroIds;

    expect(second).toBe(first);
  });

  it('with no tap frame yet, falls back to the REST rotation projection\'s own on-field heroes', () => {
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

    expect(source.getView().onFieldHeroIds).toEqual(['hero-field']);
  });
});

function createSpyLog(): { readonly log: LogPort; readonly infoRecords: Record<string, unknown>[]; readonly warnRecords: Record<string, unknown>[] } {
  const infoRecords: Record<string, unknown>[] = [];
  const warnRecords: Record<string, unknown>[] = [];
  const log = createBoundaryLog({
    transport: {
      info: (record) => infoRecords.push(record),
      warn: (record) => warnRecords.push(record),
      error: () => undefined,
      debug: () => undefined,
    },
    now: () => Date.now(),
  });
  return { log, infoRecords, warnRecords };
}

describe('LiveSource: observed and self-fetched rotation converge on one path, newest wins by timestamp', () => {
  it('an observed rotation body older than the currently applied one is dropped, not applied', () => {
    const { source, currentTap, clock } = createHarness();
    source.start();

    source.ingestRotation(buildAccountView(bodyWithHeroes([completeHero('hero-self')])), clock.ms);
    currentTap().emitHttpBody(bodyWithHeroes([completeHero('hero-observed')]), clock.ms - 1_000);

    expect(source.getView().rotation?.heroes.map((hero) => hero.id)).toEqual(['hero-self']);
  });

  it('a newer observed rotation body wins over an older self-fetched one applied afterward — decided by timestamp, not by which call happened last', () => {
    const { source, currentTap, clock } = createHarness();
    source.start();

    currentTap().emitHttpBody(bodyWithHeroes([completeHero('hero-observed')]), clock.ms + 5_000);
    source.ingestRotation(buildAccountView(bodyWithHeroes([completeHero('hero-self')])), clock.ms);

    expect(source.getView().rotation?.heroes.map((hero) => hero.id)).toEqual(['hero-observed']);
  });

  it('a newer self-fetched rotation body wins over an older observed one', () => {
    const { source, currentTap, clock } = createHarness();
    source.start();

    currentTap().emitHttpBody(bodyWithHeroes([completeHero('hero-observed')]), clock.ms);
    source.ingestRotation(buildAccountView(bodyWithHeroes([completeHero('hero-self')])), clock.ms + 5_000);

    expect(source.getView().rotation?.heroes.map((hero) => hero.id)).toEqual(['hero-self']);
  });

  it('a self-fetched read rejected as stale does not overwrite the roster cache either — the next observed body still joins names from the last read that actually applied', () => {
    const { source, currentTap, clock } = createHarness();
    source.start();

    function accountViewWithRoster(rosterHeroes: readonly Record<string, unknown>[]): AccountView {
      return {
        payload: { casa: bodyWithHeroes([completeHero('h1')]), heroes: rosterHeroes },
        gameRunning: true,
        store: { status: 'ok', reason: null, binding: 'sqlite' },
      };
    }

    source.ingestRotation(accountViewWithRoster([{ id: 'h1', name: 'Alice', rank: 'gold' }]), clock.ms);

    // A stale self-fetched read: its rotation body is rejected, and per the newest-wins rule its
    // roster must be rejected right along with it, never applied on its own.
    source.ingestRotation(accountViewWithRoster([{ id: 'h1', name: 'Bob', rank: 'silver' }]), clock.ms - 1_000);

    // An observed body carries no roster of its own — it joins whatever #lastRosterRaw currently
    // holds. If the stale read's roster had leaked through, this would name the hero "Bob".
    currentTap().emitHttpBody(bodyWithHeroes([completeHero('h1')]), clock.ms + 1_000);

    const hero = source.getView().rotation?.heroes.find((candidate) => candidate.id === 'h1');
    expect(hero?.name).toBe('Alice');
  });

  it('identifies a real /rotation-shaped body observed from traffic and feeds it through the same rotation the Live screen already renders', () => {
    const { source, currentTap, clock } = createHarness();
    source.start();

    currentTap().emitHttpBody(bodyWithHeroes([completeHero('hero-from-traffic')]), clock.ms);

    const view = source.getView();
    expect(view.rotation?.heroes.map((hero) => hero.id)).toEqual(['hero-from-traffic']);
    expect(view.onFieldHeroIds).toEqual(['hero-from-traffic']);
  });
});

describe('LiveSource: an observed body identification failure falls back to the self-fetched read, and says so', () => {
  it('an observed body matching no declared route is dropped and reported once, never guessed at', () => {
    const { log, warnRecords } = createSpyLog();
    const { source, currentTap } = createHarness({ log });
    source.start();

    currentTap().emitHttpBody({ totally: 'unrecognisable', shape: 1 }, Date.now());

    expect(warnRecords).toHaveLength(1);
    expect(warnRecords[0]).toMatchObject({ event: 'observed_body.unidentified' });
  });

  it('the self-fetched rotation still updates the view after an observed body fails to identify, proving the fallback engages', () => {
    const { log } = createSpyLog();
    const { source, currentTap, clock } = createHarness({ log });
    source.start();

    currentTap().emitHttpBody({ totally: 'unrecognisable', shape: 1 }, clock.ms);
    expect(source.getView().rotation).toBeNull();

    source.ingestRotation(buildAccountView(bodyWithHeroes([completeHero('hero-fallback')])), clock.ms + 1_000);

    expect(source.getView().rotation?.heroes.map((hero) => hero.id)).toEqual(['hero-fallback']);
  });

  it('a malformed (non-JSON) observed body is dropped and reported once, never crashing the source', () => {
    const { log, warnRecords } = createSpyLog();
    const { source, currentTap } = createHarness({ log });
    source.start();

    expect(() => {
      currentTap().emitRawHttpBody(Buffer.from('not json at all', 'utf8'), Date.now());
    }).not.toThrow();
    expect(warnRecords).toHaveLength(1);
    expect(warnRecords[0]).toMatchObject({ event: 'observed_body.malformed_json' });
  });
});

describe('LiveSource: manual diagnostics dump', () => {
  it('reports written: false with reason no-source rather than a silent success when no ring is attached', () => {
    const { source } = createHarness();
    source.start();

    expect(source.dumpDiagnostics()).toEqual({ written: false, reason: 'no-source' });
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

describe('LiveSource: countdown stability regression', () => {
  it("a hero's displayed field time never increases while its own drain conditions stay constant, even as unrelated heroes repeatedly join and leave the field", () => {
    const { source, pushFrame, goLive, clock } = createHarness();
    source.start();

    // The target carries real drain reduction (Bateria Extra rank 13, -13% self) and no team aura
    // is ever present — its true combined drain rate never changes for the length of this run.
    const casa = bodyWithHeroes([completeHero('target'), completeHero('noise1'), completeHero('noise2')]);
    source.ingestRotation(
      {
        payload: {
          casa,
          heroes: [
            { ...minimalRosterHero('target'), abilities: [{ code: 'bateria_extra', level: 13 }] },
            minimalRosterHero('noise1'),
            minimalRosterHero('noise2'),
          ],
        },
        gameRunning: true,
        store: { status: 'ok', reason: null, binding: 'sqlite' },
      },
      clock.ms,
    );
    goLive();

    const energyMax = 100;
    const trueRatePerSecond = 0.87; // combineDrainRate(0.87, 1) — Bateria Extra 13, no team aura
    const startEnergy = 90;

    const remainingReadings: number[] = [];
    const bases: string[] = [];

    // Three long stable stretches (each well past the 8-sample / 2s trust gates at this 100ms
    // cadence), each separated by exactly one membership change from a non-carrier — long enough
    // to let the fit regain 'observed' between disruptions, which is what turns a wipe-triggered
    // fallback into a VISIBLE jump rather than a wrong-but-steady line indistinguishable from a
    // correct one.
    const TOTAL_TICKS = 70;
    for (let i = 0; i < TOTAL_TICKS; i += 1) {
      const heroes: { id: string; energyFraction: number }[] = [
        { id: 'target', energyFraction: (startEnergy - trueRatePerSecond * (i * 0.1)) / energyMax },
      ];
      if (i >= 25 && i < 50) heroes.push({ id: 'noise1', energyFraction: 0.5 });
      if (i >= 50) heroes.push({ id: 'noise2', energyFraction: 0.5 });

      pushFrame({ heroes });

      const view = source.getView();
      const targetReading = view.field.find((entry) => entry.heroId === 'target');
      if (targetReading) {
        remainingReadings.push(targetReading.secondsRemaining);
        bases.push(targetReading.basis);
      }
    }

    expect(remainingReadings.length).toBeGreaterThan(TOTAL_TICKS / 2);
    let previousReading: number | undefined;
    for (const reading of remainingReadings) {
      if (previousReading !== undefined) expect(reading).toBeLessThanOrEqual(previousReading);
      previousReading = reading;
    }

    // Once the fit is trusted it stays trusted for the rest of the run — the estimated/measured
    // marker must not blink on and off while the target's own conditions never change.
    const firstObservedIndex = bases.indexOf('observed');
    if (firstObservedIndex !== -1) {
      expect(bases.slice(firstObservedIndex).every((basis) => basis === 'observed')).toBe(true);
    }
  });
});

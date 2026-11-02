import { describe, expect, it } from 'vitest';
import {
  CRASH_RESTART_DELAY_MS,
  CRASH_WINDOW_MS,
  hostPhase,
  initialHost,
  step,
  type CachedEntry,
  type CacheScan,
  type HostEffect,
  type HostEvent,
  type HostState,
} from './host-machine.js';

const NO_CACHE: CacheScan = { owner: null, bundles: [] };
const MONO = 1_000_000;

function entry(sequence: number, valid = true): CachedEntry {
  return { sequence, version: `1.0.${String(sequence)}`, valid };
}

function cacheOf(owner: string | null, ...bundles: CachedEntry[]): CacheScan {
  return { owner, bundles };
}

interface Run {
  readonly state: HostState;
  /** The effects of each event, in event order. */
  readonly steps: readonly (readonly HostEffect[])[];
  /** The effects of the last event. */
  readonly last: readonly HostEffect[];
}

function run(from: HostState, ...events: HostEvent[]): Run {
  let state = from;
  const steps: (readonly HostEffect[])[] = [];
  for (const event of events) {
    const result = step(state, event);
    state = result.state;
    steps.push(result.effects);
  }
  return { state, steps, last: steps.at(-1) ?? [] };
}

interface Boot {
  readonly subject?: string | null;
  readonly cache?: CacheScan;
  readonly dev?: { version: string } | null;
  readonly gate?: boolean;
  readonly latest?: number | null;
  readonly floor?: number;
}

/** A host that has seen the given facts and then started. */
function boot(options: Boot = {}): Run {
  const events: HostEvent[] = [];
  if (options.floor !== undefined) events.push({ t: 'floor', minSequence: options.floor });
  if (options.latest !== undefined) events.push({ t: 'latest', sequence: options.latest });
  if (options.gate !== undefined) events.push({ t: 'gate', allows: options.gate });
  events.push({
    t: 'started',
    subject: options.subject === undefined ? 'u1' : options.subject,
    dev: options.dev ?? null,
    cache: options.cache ?? NO_CACHE,
  });
  return run(initialHost(true), ...events);
}

const gate = (allows: boolean): HostEvent => ({ t: 'gate', allows });
const latest = (sequence: number | null): HostEvent => ({ t: 'latest', sequence });
const floor = (minSequence: number): HostEvent => ({ t: 'floor', minSequence });
const fetchedOk = (sequence: number): HostEvent => ({
  t: 'fetched',
  outcome: { ok: true, sequence, version: `1.0.${String(sequence)}` },
});
const fetchedRefused: HostEvent = { t: 'fetched', outcome: { ok: false, reason: 'bad_signature', sequence: 5 } };
const crash = (mono: number): HostEvent => ({ t: 'workerExit', requested: false, mono });
const removal: HostEvent = { t: 'removalRequested', reason: 'ended' };

/** Active bundle 3, gate open, worker running. */
const running = (): HostState => boot({ cache: cacheOf('u1', entry(3)), gate: true }).state;
/** Active bundle 3, gate closed, never started. */
const readyIdle = (): HostState => boot({ cache: cacheOf('u1', entry(3)), gate: false }).state;

describe('host machine: off and signed out', () => {
  it('ignores every event when the flavour has no Premium', () => {
    const result = run(
      initialHost(false),
      { t: 'started', subject: 'u1', dev: null, cache: cacheOf('u1', entry(3)) },
      gate(true),
      latest(5),
      removal,
    );
    expect(result.state).toEqual(initialHost(false));
    expect(result.steps.flat()).toEqual([]);
  });

  it('is off, with no effects, when started with nobody signed in', () => {
    const result = boot({ subject: null, cache: cacheOf('u1', entry(3)) });
    expect(result.state.phase).toBe('off');
    expect(result.last).toEqual([]);
  });

  it('stops the worker and unmounts on sign-out but keeps the folder', () => {
    const result = run(running(), { t: 'signedOut' });
    expect(result.last).toEqual([{ e: 'stopWorker' }, { e: 'publish' }]);
    expect(result.state).toMatchObject({ phase: 'off', subject: null, active: null, gate: false });
    expect(hostPhase(result.state)).toBe('none');
  });
});

describe('host machine: removal comes first', () => {
  it.each([
    ['running', () => running()],
    ['paused', () => run(running(), gate(false)).state],
    ['waiting', () => boot({ gate: true, latest: 5 }).state],
    ['stopped', () => run(running(), { t: 'mountFailed' }).state],
    ['off', () => initialHost(true)],
  ])('from %s stops the worker, reloads the window and starts deleting', (_name, from) => {
    const result = run(from(), removal);
    expect(result.last.slice(0, 3)).toEqual([{ e: 'stopWorker' }, { e: 'reloadWindow' }, { e: 'remove' }]);
    expect(result.state).toMatchObject({ phase: 'removing', active: null, staged: null, fetching: null });
  });

  it('publishes the cleared view when something was showing', () => {
    expect(run(running(), removal).last).toEqual([
      { e: 'stopWorker' },
      { e: 'reloadWindow' },
      { e: 'remove' },
      { e: 'publish' },
    ]);
  });

  it('drops every other event while removing', () => {
    const removing = run(running(), removal).state;
    const result = run(
      removing,
      gate(true),
      gate(false),
      latest(9),
      floor(9),
      fetchedOk(9),
      crash(MONO),
      { t: 'mountFailed' },
      { t: 'started', subject: 'u1', dev: null, cache: cacheOf('u1', entry(3)) },
      { t: 'signedOut' },
      { t: 'removalStep', done: false },
    );
    expect(result.steps.flat()).toEqual([]);
    expect(result.state.phase).toBe('removing');
  });

  it('answers a repeated request while still deleting with nothing more', () => {
    const removing = run(running(), removal).state;
    expect(run(removing, { t: 'removalRequested', reason: 'moved' }).last).toEqual([]);
  });

  it('says folderGone once, when the delete finishes, and not before', () => {
    const removing = run(running(), removal).state;
    const unfinished = run(removing, { t: 'removalStep', done: false });
    expect(unfinished.last).toEqual([]);
    const finished = run(unfinished.state, { t: 'removalStep', done: true }, { t: 'removalStep', done: true });
    expect(finished.steps).toEqual([[{ e: 'folderGone' }], []]);
    expect(finished.state.phase).toBe('gone');
  });

  it('treats a request after the folder is gone as a new end event', () => {
    const gone = run(running(), removal, { t: 'removalStep', done: true }).state;
    const again = run(gone, removal, { t: 'removalStep', done: true });
    expect(again.steps[0]?.map((e) => e.e)).toEqual(['stopWorker', 'reloadWindow', 'remove']);
    expect(again.steps[1]).toEqual([{ e: 'folderGone' }]);
  });

  it('never starts removal when the gate closes (Paused)', () => {
    const result = run(running(), gate(false), latest(9), gate(true));
    expect(result.steps.flat().some((e) => e.e === 'remove' || e.e === 'folderGone')).toBe(false);
  });

  it('can start again after a removal, as a fresh sign-in', () => {
    const gone = run(running(), removal, { t: 'removalStep', done: true }).state;
    const result = run(gone, { t: 'started', subject: 'u1', dev: null, cache: NO_CACHE });
    expect(result.state.phase).toBe('waiting');
  });
});

describe('host machine: start', () => {
  it('waits, with nothing to show, when the cache is empty', () => {
    const result = boot();
    expect(result.state).toMatchObject({ phase: 'waiting', active: null });
    expect(result.last).toEqual([]);
  });

  it('activates the cached bundle but does not start the worker while the gate is closed', () => {
    const result = boot({ cache: cacheOf('u1', entry(3)), gate: false });
    expect(result.last).toEqual([{ e: 'activate', sequence: 3 }, { e: 'publish' }]);
    expect(result.state).toMatchObject({ phase: 'ready', active: { sequence: 3, version: '1.0.3', dev: false } });
    expect(hostPhase(result.state)).toBe('paused');
  });

  it('starts the worker at once when the gate was already open', () => {
    const result = boot({ cache: cacheOf('u1', entry(3)), gate: true });
    expect(result.last).toEqual([{ e: 'activate', sequence: 3 }, { e: 'startWorker' }, { e: 'publish' }]);
    expect(result.state.phase).toBe('running');
  });

  it('activates the newest cached bundle and prunes the older ones', () => {
    const result = boot({ cache: cacheOf('u1', entry(3), entry(4)) });
    expect(result.last).toEqual([{ e: 'activate', sequence: 4 }, { e: 'pruneCache', keep: 4 }, { e: 'publish' }]);
  });

  it('skips a newer cached bundle that fails re-verification', () => {
    const result = boot({ cache: cacheOf('u1', entry(3), entry(4, false)) });
    expect(result.last).toEqual([{ e: 'activate', sequence: 3 }, { e: 'pruneCache', keep: 3 }, { e: 'publish' }]);
  });

  it('drops a cache where nothing re-verifies', () => {
    const result = boot({ cache: cacheOf('u1', entry(3, false)) });
    expect(result.last).toEqual([{ e: 'dropCache' }]);
    expect(result.state.phase).toBe('waiting');
  });

  it('drops another subject\'s cache first and never runs it', () => {
    const result = boot({ cache: cacheOf('someone-else', entry(3)), gate: true });
    expect(result.last).toEqual([{ e: 'dropCache' }, { e: 'publish' }]);
    expect(result.state).toMatchObject({ phase: 'waiting', active: null });
  });

  it('waits and drops a cached bundle that is below the Lease floor', () => {
    const result = boot({ cache: cacheOf('u1', entry(7)), floor: 8 });
    expect(result.last).toEqual([{ e: 'dropCache' }]);
    expect(result.state).toMatchObject({ phase: 'waiting', active: null });
  });

  it('downloads at start when the gate is open and a newer bundle is named', () => {
    const result = boot({ cache: cacheOf('u1', entry(3)), gate: true, latest: 5 });
    expect(result.last).toEqual([
      { e: 'activate', sequence: 3 },
      { e: 'startWorker' },
      { e: 'fetch', sequence: 5 },
      { e: 'publish' },
    ]);
  });

  it('loads the development bundle without reading the cache, and starts it only when the gate is open', () => {
    const idle = boot({ dev: { version: '0.0.0-dev' }, cache: cacheOf('someone-else', entry(9)) });
    expect(idle.last).toEqual([{ e: 'activate', sequence: 0 }, { e: 'publish' }]);
    expect(idle.state.active).toEqual({ sequence: 0, version: '0.0.0-dev', dev: true });
    const open = boot({ dev: { version: '0.0.0-dev' }, gate: true });
    expect(open.last).toEqual([{ e: 'activate', sequence: 0 }, { e: 'startWorker' }, { e: 'publish' }]);
  });
});

describe('host machine: the Lease floor', () => {
  it('only records a floor at or below the active bundle', () => {
    const result = run(running(), floor(3));
    expect(result.last).toEqual([]);
    expect(result.state.floor).toBe(3);
  });

  it('swaps to a staged bundle that meets the floor, reloading the window', () => {
    const staged = run(running(), latest(5), fetchedOk(5)).state;
    const result = run(staged, floor(5));
    expect(result.last).toEqual([
      { e: 'stopWorker' },
      { e: 'activate', sequence: 5 },
      { e: 'pruneCache', keep: 5 },
      { e: 'reloadWindow' },
      { e: 'startWorker' },
      { e: 'publish' },
    ]);
    expect(result.state).toMatchObject({ phase: 'running', active: { sequence: 5 }, staged: null });
  });

  it('starts nothing after a swap while the gate is closed', () => {
    const staged = run(running(), latest(5), fetchedOk(5), gate(false)).state;
    const result = run(staged, floor(5));
    expect(result.last).not.toContainEqual({ e: 'startWorker' });
    expect(result.state.phase).toBe('ready');
    expect(run(result.state, gate(true)).last).toContainEqual({ e: 'startWorker' });
  });

  it('with nothing cached that meets it, drops the cache and reloads', () => {
    const result = run(running(), floor(5));
    expect(result.last).toEqual([{ e: 'stopWorker' }, { e: 'dropCache' }, { e: 'reloadWindow' }, { e: 'publish' }]);
    expect(result.state).toMatchObject({ phase: 'waiting', active: null });
    expect(hostPhase(result.state)).toBe('updating');
  });

  it('downloads the newest named bundle once the floor leaves nothing to run', () => {
    const named = run(boot({ cache: cacheOf('u1', entry(3)), gate: true }).state, floor(5), latest(6));
    expect(named.last).toEqual([{ e: 'fetch', sequence: 6 }]);
    const known = run(boot({ cache: cacheOf('u1', entry(3)), gate: true, latest: 3 }).state, latest(6));
    expect(known.last).toEqual([{ e: 'fetch', sequence: 6 }]);
  });

  it('keeps a download already in flight when the floor passes the running bundle', () => {
    const result = run(running(), latest(6), floor(5));
    expect(result.steps[1]).toEqual([{ e: 'stopWorker' }, { e: 'dropCache' }, { e: 'reloadWindow' }, { e: 'publish' }]);
    expect(result.state.fetching).toBe(6);
  });

  it('ignores a staged bundle that is itself below the floor', () => {
    const staged = run(running(), latest(4), fetchedOk(4)).state;
    const result = run(staged, floor(5));
    expect(result.last).toContainEqual({ e: 'dropCache' });
    expect(result.state.active).toBeNull();
  });

  it('shows "updating" without downloading when the newest named bundle is below the floor', () => {
    const result = run(running(), latest(4), floor(5));
    expect(result.last).not.toContainEqual(expect.objectContaining({ e: 'fetch' }));
    expect(result.state.phase).toBe('waiting');
  });

  it('leaves the development bundle running whatever the floor', () => {
    const dev = boot({ dev: { version: 'dev' }, gate: true }).state;
    const result = run(dev, floor(99));
    expect(result.last).toEqual([]);
    expect(result.state.phase).toBe('running');
  });
});

describe('host machine: the gate', () => {
  it('pauses a running worker and unmounts in the same step', () => {
    const result = run(running(), gate(false));
    expect(result.last).toEqual([{ e: 'pauseWorker' }, { e: 'publish' }]);
    expect(result.state.phase).toBe('ready');
    expect(hostPhase(result.state)).toBe('paused');
  });

  it('resumes the same worker when the gate opens again, without a start', () => {
    const result = run(running(), gate(false), gate(true));
    expect(result.last).toEqual([{ e: 'resumeWorker' }, { e: 'publish' }]);
    expect(result.state.phase).toBe('running');
  });

  it('starts the worker the first time the gate opens', () => {
    const result = run(readyIdle(), gate(true));
    expect(result.last).toEqual([{ e: 'startWorker' }, { e: 'publish' }]);
  });

  it('never starts the worker while the gate is closed, whatever else happens', () => {
    const result = run(readyIdle(), latest(5), floor(0), gate(false), fetchedOk(5));
    expect(result.steps.flat()).not.toContainEqual(expect.objectContaining({ e: 'startWorker' }));
    expect(result.steps.flat()).not.toContainEqual(expect.objectContaining({ e: 'resumeWorker' }));
  });

  it('does nothing for a gate value it already has', () => {
    expect(run(running(), gate(true)).last).toEqual([]);
    expect(run(readyIdle(), gate(false)).last).toEqual([]);
  });

  it('with nothing active, a gate opening downloads the newest bundle and shows "updating"', () => {
    const result = run(boot({ latest: 5 }).state, gate(true));
    expect(result.last).toEqual([{ e: 'fetch', sequence: 5 }, { e: 'publish' }]);
    expect(hostPhase(result.state)).toBe('updating');
  });
});

describe('host machine: downloads', () => {
  it('sends no request while the gate is closed', () => {
    expect(run(readyIdle(), latest(5)).last).toEqual([]);
  });

  it('downloads a newer bundle in the background while the active one runs', () => {
    const result = run(running(), latest(5));
    expect(result.last).toEqual([{ e: 'fetch', sequence: 5 }]);
    expect(result.state.phase).toBe('running');
  });

  it.each([3, 2])('does not download a bundle no newer than the active one (%i)', (named) => {
    expect(run(running(), latest(named)).last).toEqual([]);
  });

  it('does not download a bundle no newer than the staged one', () => {
    const staged = run(running(), latest(5), fetchedOk(5)).state;
    expect(run(staged, latest(5)).last).toEqual([]);
  });

  it('sends nothing when no bundle is named, and shows "updating" with nothing cached', () => {
    const result = run(boot().state, gate(true), latest(null));
    expect(result.steps.flat().some((e) => e.e === 'fetch')).toBe(false);
    expect(result.state.phase).toBe('waiting');
    expect(hostPhase(result.state)).toBe('updating');
  });

  it('drops a trigger while a download runs', () => {
    const result = run(running(), latest(5), latest(6), gate(false), gate(true));
    expect(result.steps.flat().filter((e) => e.e === 'fetch')).toEqual([{ e: 'fetch', sequence: 5 }]);
  });

  it('after two renewals during one download fetches only the higher afterwards', () => {
    const result = run(running(), latest(5), latest(6), latest(7), fetchedOk(5));
    expect(result.last).toEqual([{ e: 'persist', sequence: 5 }, { e: 'fetch', sequence: 7 }]);
  });

  it('does not retry a refused download until the next renewal or the gate opening', () => {
    const refused = run(boot({ gate: true, latest: 5 }).state, fetchedRefused);
    expect(refused.state.fetching).toBeNull();
    expect(refused.last).toEqual([]);
    expect(run(refused.state, latest(5)).last).toEqual([{ e: 'fetch', sequence: 5 }]);
    expect(run(refused.state, gate(false), gate(true)).steps[1]).toContainEqual({ e: 'fetch', sequence: 5 });
  });

  it('does not download over the development bundle', () => {
    const dev = boot({ dev: { version: 'dev' }, gate: true }).state;
    expect(run(dev, latest(5)).last).toEqual([]);
  });
});

describe('host machine: a download ends', () => {
  it('with nothing active installs the bundle and, with the gate open, starts it', () => {
    const waiting = run(boot().state, latest(5), gate(true));
    const result = run(waiting.state, fetchedOk(5));
    expect(result.last).toEqual([
      { e: 'persist', sequence: 5 },
      { e: 'activate', sequence: 5 },
      { e: 'startWorker' },
      { e: 'publish' },
    ]);
    expect(result.state).toMatchObject({ phase: 'running', active: { sequence: 5, version: '1.0.5' } });
  });

  it('with nothing active and the gate closed in the meantime, installs it paused', () => {
    const result = run(boot({ gate: true, latest: 5 }).state, gate(false), fetchedOk(5));
    expect(result.last).toEqual([{ e: 'persist', sequence: 5 }, { e: 'activate', sequence: 5 }, { e: 'publish' }]);
    expect(result.state.phase).toBe('ready');
  });

  it('with a bundle running only stages the new one: no swap mid-session', () => {
    const result = run(running(), latest(5), fetchedOk(5));
    expect(result.last).toEqual([{ e: 'persist', sequence: 5 }]);
    expect(result.state).toMatchObject({
      phase: 'running',
      active: { sequence: 3 },
      staged: { sequence: 5, version: '1.0.5' },
    });
  });

  it('after a refusal changes nothing but the download slot', () => {
    const before = run(running(), latest(5)).state;
    const result = run(before, fetchedRefused);
    expect(result.last).toEqual([]);
    expect(result.state).toEqual({ ...before, fetching: null });
  });

  it('drops an answer nobody asked for', () => {
    const result = run(running(), fetchedOk(5));
    expect(result.last).toEqual([]);
    expect(result.state.staged).toBeNull();
  });

  it('writes nothing for a bundle the floor has since passed', () => {
    const result = run(boot({ gate: true, latest: 5 }).state, floor(6), fetchedOk(5));
    expect(result.last).toEqual([]);
    expect(result.state.active).toBeNull();
  });

  it('only records the file for a bundle that finishes after the worker stopped', () => {
    const result = run(running(), latest(5), crash(MONO), crash(MONO + 1000), fetchedOk(5));
    expect(result.last).toEqual([{ e: 'persist', sequence: 5 }]);
    expect(result.state.phase).toBe('stopped');
  });
});

describe('host machine: a worker exits on its own', () => {
  it('restarts once after five seconds', () => {
    const result = run(running(), crash(MONO));
    expect(result.last).toEqual([{ e: 'startWorker', delayMs: CRASH_RESTART_DELAY_MS }]);
    expect(result.state.phase).toBe('running');
  });

  it('stops for good on a second exit within ten minutes', () => {
    const result = run(running(), crash(MONO), crash(MONO + CRASH_WINDOW_MS - 1000));
    expect(result.last).toEqual([{ e: 'stopWorker' }, { e: 'publish' }]);
    expect(result.state.phase).toBe('stopped');
    expect(hostPhase(result.state)).toBe('stopped');
  });

  it('restarts again when the earlier exit is more than ten minutes old', () => {
    const result = run(running(), crash(MONO), crash(MONO + CRASH_WINDOW_MS + 1000));
    expect(result.last).toEqual([{ e: 'startWorker', delayMs: CRASH_RESTART_DELAY_MS }]);
    expect(result.state.phase).toBe('running');
  });

  it('counts only exits inside the window when a third arrives', () => {
    const result = run(
      running(),
      crash(MONO),
      crash(MONO + CRASH_WINDOW_MS + 1000),
      crash(MONO + CRASH_WINDOW_MS + 2000),
    );
    expect(result.state.phase).toBe('stopped');
  });

  it('ignores the host\'s own kill', () => {
    const result = run(running(), { t: 'workerExit', requested: true, mono: MONO });
    expect(result.last).toEqual([]);
    expect(result.state).toEqual(running());
  });

  it('does not restart a paused worker; the next gate opening starts a fresh one', () => {
    const paused = run(running(), gate(false));
    const died = run(paused.state, crash(MONO));
    expect(died.last).toEqual([]);
    expect(run(died.state, gate(true)).last).toEqual([{ e: 'startWorker' }, { e: 'publish' }]);
  });

  it('keeps a stopped host stopped through a gate opening and a newer renewal', () => {
    const stopped = run(running(), crash(MONO), crash(MONO + 1000)).state;
    const result = run(stopped, gate(false), gate(true), latest(9));
    expect(result.steps.flat().filter((e) => e.e !== 'publish')).toEqual([]);
    expect(result.state.phase).toBe('stopped');
  });
});

describe('host machine: the UI fails to mount', () => {
  it('stops the worker and stays stopped until the next start', () => {
    const result = run(running(), { t: 'mountFailed' });
    expect(result.last).toEqual([{ e: 'stopWorker' }, { e: 'publish' }]);
    expect(result.state.phase).toBe('stopped');
    expect(run(result.state, gate(false), gate(true)).steps.flat().map((e) => e.e)).not.toContain('startWorker');
  });

  it('starts again at the next app start', () => {
    const stopped = run(running(), { t: 'mountFailed' }).state;
    const result = run(stopped, { t: 'started', subject: 'u1', dev: null, cache: cacheOf('u1', entry(3)) });
    expect(result.state.phase).toBe('running');
    expect(result.last).toContainEqual({ e: 'startWorker' });
  });
});

describe('host machine: two things at once', () => {
  it('removal and a download answer: the answer is dropped, nothing is written or started', () => {
    const waiting = run(boot().state, latest(5), gate(true)).state;
    const result = run(waiting, removal, fetchedOk(5));
    expect(result.steps[1]).toEqual([]);
    expect(result.state).toMatchObject({ phase: 'removing', active: null, staged: null });
  });

  it('a download answer, then removal: the removal still clears what the answer installed', () => {
    const waiting = run(boot().state, latest(5), gate(true)).state;
    const result = run(waiting, fetchedOk(5), removal);
    expect(result.last.slice(0, 3)).toEqual([{ e: 'stopWorker' }, { e: 'reloadWindow' }, { e: 'remove' }]);
    expect(result.state).toMatchObject({ phase: 'removing', active: null });
  });

  it('a floor raise and the gate closing, in either order, end paused on the staged bundle', () => {
    const staged = run(running(), latest(5), fetchedOk(5)).state;
    for (const events of [[floor(5), gate(false)], [gate(false), floor(5)]]) {
      const result = run(staged, ...events);
      expect(result.state).toMatchObject({ phase: 'ready', active: { sequence: 5 }, staged: null });
      expect(hostPhase(result.state)).toBe('paused');
    }
    const afterGate = run(staged, gate(false), floor(5));
    expect(afterGate.steps.flat()).not.toContainEqual({ e: 'startWorker' });
    const afterFloor = run(staged, floor(5), gate(false));
    expect(afterFloor.steps[1]).toEqual([{ e: 'pauseWorker' }, { e: 'publish' }]);
  });

  it('the gate opening with nothing cached and no bundle named: no request, "updating" shown', () => {
    const result = run(boot().state, gate(true), latest(null));
    expect(result.steps.flat()).toEqual([{ e: 'publish' }]);
    expect(result.state.phase).toBe('waiting');
  });

  it('a crash and removal: the pending restart is cancelled and a late exit starts nothing', () => {
    const crashed = run(running(), crash(MONO));
    expect(crashed.last).toEqual([{ e: 'startWorker', delayMs: CRASH_RESTART_DELAY_MS }]);
    const result = run(crashed.state, removal, crash(MONO + 1000), { t: 'workerExit', requested: true, mono: MONO + 2000 });
    expect(result.steps[0]?.[0]).toEqual({ e: 'stopWorker' });
    expect(result.steps.slice(1).flat()).toEqual([]);
    expect(result.state.phase).toBe('removing');
  });

  it('a pause during the restart delay resumes by starting a fresh worker', () => {
    const result = run(running(), crash(MONO), gate(false), gate(true));
    expect(result.steps[1]).toEqual([{ e: 'pauseWorker' }, { e: 'publish' }]);
    expect(result.steps[2]).toEqual([{ e: 'resumeWorker' }, { e: 'publish' }]);
  });

  it('a staged bundle and a floor only it meets: the staged one is activated with a reload', () => {
    const state = run(running(), latest(5), fetchedOk(5), latest(6), fetchedOk(6)).state;
    expect(state.staged?.sequence).toBe(6);
    const result = run(state, floor(6));
    expect(result.last).toContainEqual({ e: 'activate', sequence: 6 });
    expect(result.last).toContainEqual({ e: 'reloadWindow' });
  });

  it('sign-out with a download in flight: the answer is dropped', () => {
    const inFlight = run(running(), latest(5)).state;
    const result = run(inFlight, { t: 'signedOut' }, fetchedOk(5));
    expect(result.steps[1]).toEqual([]);
    expect(result.state).toMatchObject({ phase: 'off', active: null, staged: null, fetching: null });
  });

  it('sign-out and then a new sign-in starts from the cache again', () => {
    const out = run(running(), { t: 'signedOut' }).state;
    const back = run(out, { t: 'started', subject: 'u1', dev: null, cache: cacheOf('u1', entry(3)) });
    expect(back.state.phase).toBe('ready');
  });
});

describe('host machine: purity', () => {
  it('does not change the state it is given', () => {
    const before = running();
    const frozen = Object.freeze({ ...before, crashes: Object.freeze([...before.crashes]) });
    expect(() => step(frozen, crash(MONO))).not.toThrow();
    expect(frozen).toEqual(before);
  });
});

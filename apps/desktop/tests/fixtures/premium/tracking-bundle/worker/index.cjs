'use strict';

// The tracking check worker. It keeps one throwaway table `t`, listens to both game feeds, and
// writes what it saw into `store`, where the panel and a smoke test read it. It answers its own
// panel's messages: an echo, its recorded state, a forwarded `db` call, and feed switches.

const KEPT_ITEMS = 8;
// `store` shares one 60-a-minute budget with the panel's reads, and the replayed tap never stops, so
// the worker writes at most once per FLUSH_MS and only the lists that changed.
const FLUSH_MS = 2000;

const failure = (error) => ({
  ok: false,
  code: (error && error.message) || 'error',
  reason: (error && error.reason) || null,
});

module.exports.start = function start(host) {
  const call = (capability, args) => host.call(capability, args);
  const store = (args) => call('store', args);

  const state = {
    starts: 0,
    sequence: host.info.sequence,
    granted: [...host.info.granted],
    db: { status: 'pending', rows: null, note: null },
    subscribed: { tap: false, battleLog: false },
    tapCount: 0,
    battleLogCount: 0,
    gaps: 0,
    cleared: 0,
    paused: 0,
    resumed: 0,
    uiMessages: 0,
  };
  let tapItems = [];
  let battleItems = [];
  let timer = null;
  let tapDirty = true;
  let battleDirty = true;

  async function flush() {
    timer = null;
    const writeTap = tapDirty;
    const writeBattle = battleDirty;
    tapDirty = false;
    battleDirty = false;
    try {
      await store({ op: 'set', key: 'trk.state', value: state });
      if (writeTap) await store({ op: 'set', key: 'trk.tap', value: tapItems });
      if (writeBattle) await store({ op: 'set', key: 'trk.battle', value: battleItems });
    } catch (error) {
      tapDirty = tapDirty || writeTap;
      battleDirty = battleDirty || writeBattle;
      // Refused while paused or stopping: the next event writes again.
    }
  }

  function changed() {
    if (timer === null) timer = setTimeout(flush, FLUSH_MS);
  }

  async function subscribe(feed, op) {
    await call(feed, { op });
    state.subscribed[feed === 'raw.tap' ? 'tap' : 'battleLog'] = op === 'subscribe';
    changed();
  }

  host.on('raw.tap', (item) => {
    state.tapCount += 1;
    if (tapItems.length < KEPT_ITEMS) {
      tapItems.push(item);
      tapDirty = true;
    }
    changed();
  });
  host.on('raw.battleLog', (item) => {
    state.battleLogCount += 1;
    if (battleItems.length < KEPT_ITEMS) {
      battleItems.push(item);
      battleDirty = true;
    }
    changed();
  });
  host.on('raw.gap', () => {
    state.gaps += 1;
    changed();
  });
  host.on('db.cleared', () => {
    state.cleared += 1;
    call('log', { event: 'db.cleared', fields: { count: state.cleared } }).catch(() => undefined);
    changed();
  });
  host.on('paused', () => {
    state.paused += 1;
    changed();
  });
  host.on('resumed', () => {
    state.resumed += 1;
    changed();
  });

  host.onUiMessage(async (msg) => {
    state.uiMessages += 1;
    const op = msg && msg.op;
    if (op === 'echo') return { ok: true, echo: msg.value, sequence: host.info.sequence };
    if (op === 'state') return { ok: true, state, tap: tapItems, battle: battleItems };
    if (op === 'reset') {
      tapItems = [];
      battleItems = [];
      tapDirty = true;
      battleDirty = true;
      state.tapCount = 0;
      state.battleLogCount = 0;
      changed();
      return { ok: true };
    }
    if (op === 'db') {
      try {
        return { ok: true, value: await call('db', msg.args) };
      } catch (error) {
        return failure(error);
      }
    }
    if (op === 'subscribe' || op === 'unsubscribe') {
      try {
        await subscribe(msg.feed === 'raw.battleLog' ? 'raw.battleLog' : 'raw.tap', op);
        return { ok: true };
      } catch (error) {
        return failure(error);
      }
    }
    throw new Error('unknown_op');
  });

  async function boot() {
    const previous = await store({ op: 'get', key: 'trk.starts' }).catch(() => null);
    state.starts = (typeof previous === 'number' ? previous : 0) + 1;
    await store({ op: 'set', key: 'trk.starts', value: state.starts });

    try {
      await call('db', { op: 'exec', sql: 'CREATE TABLE IF NOT EXISTS t (v VARCHAR)' });
      const counted = await call('db', { op: 'query', sql: 'SELECT count(*) AS n FROM t' });
      const first = counted.rows[0];
      let rows = Number(Array.isArray(first) ? first[0] : first.n);
      if (rows === 0) {
        await call('db', { op: 'exec', sql: 'INSERT INTO t VALUES ($1)', params: ['first-run'] });
        rows = 1;
      }
      state.db = { status: 'ready', rows, note: null };
    } catch (error) {
      state.db = { status: 'failed', rows: null, note: failure(error).code };
    }

    for (const feed of ['raw.tap', 'raw.battleLog']) {
      await subscribe(feed, 'subscribe').catch(() => undefined);
    }
    await call('log', { event: 'tracking.ready', fields: { starts: state.starts } }).catch(() => undefined);
    await flush();
  }

  boot().catch(() => undefined);
};

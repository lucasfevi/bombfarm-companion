import { createElement, useEffect, useState } from 'app://bundle/_premium/_shared/react.js';

// The tracking check panel: it prints what the worker stored, one round trip to the worker, and
// what its own `db` read sees, as plain text with test ids. Nothing here is styled or clever.
const KEYS = ['trk.state', 'trk.tap', 'trk.battle'];

function line(testId, label, value) {
  return createElement('p', { 'data-testid': testId }, `${label}: ${value}`);
}

const refused = (error) => `refused ${error.code}${error.reason ? ` ${error.reason}` : ''}`;

async function readRow(premium) {
  try {
    const answer = await premium.call('db', { op: 'query', sql: 'SELECT v FROM t' });
    return { row: answer.rows.length === 0 ? 'none' : String(answer.rows[0][0]), detail: 'read' };
  } catch (error) {
    if (error.code === 'failed' && error.reason === 'catalog') return { row: 'none', detail: 'no_table' };
    return { row: refused(error), detail: 'refused' };
  }
}

export default function TrackingPanel({ premium }) {
  const [stored, setStored] = useState({});
  const [row, setRow] = useState({ row: 'pending', detail: 'pending' });
  const [worker, setWorker] = useState('pending');
  const [paused, setPaused] = useState('none');

  useEffect(() => {
    premium.on('paused', ({ reason }) => setPaused(reason ?? 'unknown'));
    premium.on('resumed', () => setPaused('none'));
  }, [premium]);

  useEffect(() => {
    let live = true;
    const read = async () => {
      const next = {};
      for (const key of KEYS) {
        try {
          next[key] = await premium.call('store', { op: 'get', key });
        } catch {
          return; // Refused (paused, stopped): keep what is shown.
        }
      }
      const nextRow = await readRow(premium);
      if (live) {
        setStored(next);
        setRow(nextRow);
      }
    };
    read();
    const timer = setInterval(read, 400);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [premium]);

  // One message to the worker's own handler; asked again until it answers.
  useEffect(() => {
    let live = true;
    let timer = null;
    const ask = async () => {
      try {
        const answer = await premium.call('premium.worker', { op: 'echo', value: `ping-${premium.slot}` });
        if (live) setWorker(`ok ${answer.echo}`);
      } catch (error) {
        if (live) {
          setWorker(refused(error));
          timer = setTimeout(ask, 500);
        }
      }
    };
    ask();
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [premium]);

  const state = stored['trk.state'] ?? null;
  const tap = stored['trk.tap'] ?? [];
  const battle = stored['trk.battle'] ?? [];
  return createElement(
    'div',
    { 'data-premium-fixture': '', 'data-testid': 'tracking-panel' },
    createElement('p', { 'data-testid': 'tracking-marker' }, 'bfc-premium-fixture-marker'),
    line('tracking-slot', 'slot', premium.slot),
    line('tracking-worker', 'worker', worker),
    line('tracking-row', 'row', row.row),
    line('tracking-row-detail', 'rowdetail', row.detail),
    line('tracking-starts', 'starts', state?.starts ?? 'pending'),
    line('tracking-sequence', 'sequence', state?.sequence ?? 'pending'),
    line('tracking-granted', 'granted', state ? state.granted.join(',') : 'pending'),
    line('tracking-db', 'db', state ? `${state.db.status} ${state.db.rows ?? ''}`.trim() : 'pending'),
    line('tracking-subscribed', 'subscribed', state ? `tap=${state.subscribed.tap} battleLog=${state.subscribed.battleLog}` : 'pending'),
    line('tracking-tap-count', 'tap', state?.tapCount ?? 'pending'),
    line('tracking-battle-count', 'battleLog', state?.battleLogCount ?? 'pending'),
    line('tracking-cleared', 'cleared', state?.cleared ?? 'pending'),
    line('tracking-paused', 'paused', paused),
    createElement('pre', { 'data-testid': 'tracking-tap-items' }, JSON.stringify(tap)),
    createElement('pre', { 'data-testid': 'tracking-battle-items' }, JSON.stringify(battle)),
  );
}

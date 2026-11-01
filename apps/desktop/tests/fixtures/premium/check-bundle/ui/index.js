import { createElement, useEffect, useState } from 'app://bundle/_premium/_shared/react.js';

// The capability check panel: it reads what the worker wrote through `store` and prints it as plain
// text with test ids, so a smoke test can read it from the page. Nothing here is styled or clever.
const KEYS = ['check.results', 'check.starts', 'check.sequence'];

function line(testId, label, value) {
  return createElement('p', { 'data-testid': testId }, `${label}: ${value}`);
}

function summary(results, name) {
  const entry = results?.[name];
  if (entry === undefined) return 'pending';
  return entry.ok ? `ok ${entry.note ?? ''}`.trim() : `refused ${entry.code}`;
}

export default function CheckPanel({ premium }) {
  const [stored, setStored] = useState({});
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
      if (live) setStored(next);
    };
    read();
    const timer = setInterval(read, 400);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [premium]);

  const results = stored['check.results'] ?? undefined;
  return createElement(
    'div',
    { 'data-premium-fixture': '', 'data-testid': 'check-panel' },
    createElement('p', { 'data-testid': 'check-marker' }, 'bfc-premium-fixture-marker'),
    line('check-status', 'status', summary(results, 'status')),
    line('check-store', 'store', summary(results, 'store')),
    line('check-log', 'log', summary(results, 'log')),
    line('check-notify', 'notify', summary(results, 'notify')),
    line('check-starts', 'starts', stored['check.starts'] ?? 'pending'),
    line('check-sequence', 'sequence', stored['check.sequence'] ?? 'pending'),
    line('check-paused', 'paused', paused),
  );
}

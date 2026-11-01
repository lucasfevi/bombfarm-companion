'use strict';

// The capability check worker: it calls each of the four capabilities once and writes what came
// back into `store`, where the panel reads it. It also counts its own starts there.

const codeOf = (error) => (error && error.message) || 'error';

async function attempt(work) {
  try {
    return { ok: true, note: await work() };
  } catch (error) {
    return { ok: false, code: codeOf(error) };
  }
}

module.exports.start = async function start(host) {
  const store = (args) => host.call('store', args);

  const previous = await store({ op: 'get', key: 'check.starts' }).catch(() => null);
  const starts = (typeof previous === 'number' ? previous : 0) + 1;
  await store({ op: 'set', key: 'check.starts', value: starts });
  await store({ op: 'set', key: 'check.sequence', value: host.info.sequence });

  const results = {};
  results.status = await attempt(async () => {
    const answer = await host.call('premium.status');
    return `active=${answer.active} audience=${answer.audience} paused=${answer.paused}`;
  });
  results.store = await attempt(async () => {
    const back = await store({ op: 'get', key: 'check.starts' });
    if (back !== starts) throw new Error('mismatch');
    return `read-back=${back}`;
  });
  results.log = await attempt(async () => {
    await host.call('log', { event: 'check.ran', fields: { starts, sequence: host.info.sequence } });
    return 'written';
  });
  results.notify = await attempt(async () => {
    await host.call('notify', { id: 'premium.test' });
    return 'shown';
  });
  await store({ op: 'set', key: 'check.results', value: results });
};

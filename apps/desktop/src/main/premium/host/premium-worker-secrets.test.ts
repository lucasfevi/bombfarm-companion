import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createLogSink } from '../premium-test-support.js';
import { SECRETS } from '../premium-test-support.js';
import { DEVICE_ID, MACHINE_GUID, SALT, USER } from '../licence/licence-test-support.js';
import { createFakeFork } from './host-fakes.js';
import {
  createHostRig,
  ECHO_CAPABILITY,
  flush,
  SUBJECT,
  workerOptions,
  type HostRig,
} from './host-service-test-support.js';
import { createWorkerSupervisor } from './worker-supervisor.js';

/** The host's own source files: everything beside this folder's tests and test support. */
function hostSources(): Array<{ name: string; text: string }> {
  return readdirSync(__dirname)
    .filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts') && !name.endsWith('.d.ts'))
    .filter((name) => !/(^|-)(fakes|test-support)\.ts$/.test(name))
    .map((name) => ({ name, text: readFileSync(join(__dirname, name), 'utf8') }));
}

/** Every `postMessage(...)` call in a source, with its argument text; declarations are skipped. */
function postMessageCalls(text: string): string[] {
  const calls: string[] = [];
  let from = 0;
  for (;;) {
    const at = text.indexOf('postMessage(', from);
    if (at === -1) return calls;
    from = at + 'postMessage('.length;
    let depth = 1;
    let end = from;
    while (end < text.length && depth > 0) {
      const char = text[end];
      if (char === '(') depth += 1;
      else if (char === ')') depth -= 1;
      end += 1;
    }
    const argument = text
      .slice(from, end - 1)
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/,$/, '');
    const after = text.slice(end).trimStart();
    const declaration = after.startsWith(':') || after.startsWith('{');
    if (!declaration) calls.push(argument);
  }
}

/**
 * The calls the host may make, per file. A message to the worker is built by the one `toWorker`
 * function (or is the typed reply the capability channel posts); the other two calls are the worker's
 * own code going over its dedicated port, and the loader answering in the other direction.
 */
const ALLOWED_CALLS: Readonly<Record<string, readonly string[]>> = {
  'capability-channel.ts': ['message'],
  'worker-loader.ts': ['{ id, capability, args }'],
  'worker-supervisor.ts': [
    "toWorker({ t: 'init', sequence: bundle.sequence, version: bundle.version, granted: channel.granted }), [capability.port2, code.port2]",
    'bundle.workerBytes.slice().buffer',
  ],
};

function violations(sources: ReadonlyArray<{ name: string; text: string }>): string[] {
  const found: string[] = [];
  for (const { name, text } of sources) {
    const calls = postMessageCalls(text);
    const allowed = [...(ALLOWED_CALLS[name] ?? [])];
    for (const call of calls) {
      const index = allowed.indexOf(call);
      if (index === -1) found.push(`${name}: postMessage(${call})`);
      else allowed.splice(index, 1);
    }
  }
  return found;
}

describe('every message to a Premium worker is built in one place', () => {
  it('finds only the known postMessage call sites under the host folder', () => {
    const sources = hostSources();
    expect(sources.length).toBeGreaterThan(5);
    expect(violations(sources)).toEqual([]);
  });

  it('finds the supervisor and channel call sites, so the scan is not vacuous', () => {
    const seen = hostSources().map(({ name, text }) => [name, postMessageCalls(text).length] as const);
    expect(Object.fromEntries(seen.filter(([, count]) => count > 0))).toEqual({
      'capability-channel.ts': 1,
      'worker-loader.ts': 1,
      'worker-supervisor.ts': 2,
    });
  });

  it('fails on a planted raw message in a new file', () => {
    const planted = { name: 'planted.ts', text: 'export const leak = (child: Child, token: string) => child.postMessage({ token });' };
    expect(violations([...hostSources(), planted])).toEqual(['planted.ts: postMessage({ token })']);
  });

  it('fails on a raw message planted beside the supervisor’s own', () => {
    const supervisor = hostSources().find((source) => source.name === 'worker-supervisor.ts');
    const planted = { name: 'worker-supervisor.ts', text: `${supervisor?.text ?? ''}\nchild.postMessage({ salt });\n` };
    expect(violations([planted])).toEqual(['worker-supervisor.ts: postMessage({ salt })']);
  });

  it('fails when the init message stops going through the one builder', () => {
    const supervisor = hostSources().find((source) => source.name === 'worker-supervisor.ts');
    const changed = (supervisor?.text ?? '').replace('toWorker({', '({');
    expect(violations([{ name: 'worker-supervisor.ts', text: changed }])).not.toEqual([]);
  });
});

const SESSION_TOKEN = SECRETS.token;
const SIGN_IN_TOKEN = SECRETS.rotatedToken;
const DEVICE_PRIVATE_KEY = 'MC4CAQAwBQYDK2VwBCIEIdevice-private-key-marker-5521';
const CAPABILITY_ARGS_MARKER = 'capability-args-marker-3317';

const SECRET_MARKERS: ReadonlyArray<[string, string]> = [
  ['session token', SESSION_TOKEN],
  ['sign-in token', SIGN_IN_TOKEN],
  ['device private key', DEVICE_PRIVATE_KEY],
  ['fingerprint salt', SALT],
  ['fingerprint salt bytes', Buffer.from(SALT, 'base64url').toString('hex')],
  ['machine guid', MACHINE_GUID],
  ['device id', DEVICE_ID],
  ['subject', USER],
  ['SteamID', SECRETS.steamId64],
  ['game account id', SECRETS.accountId],
];

let rig: HostRig | null = null;
afterEach(async () => {
  await rig?.dispose();
  rig = null;
});

/** Text a record could carry a file's bytes as: raw, hex or base64. */
function renderings(bytes: Uint8Array): string[] {
  const buffer = Buffer.from(bytes);
  return [buffer.toString('utf8'), buffer.toString('hex'), buffer.toString('base64'), buffer.toString('base64url')];
}

describe('a fixture run through the runner keeps secrets out of messages, views and logs', () => {
  it('shows no secret, bundle byte or capability argument outside the worker’s own code', async () => {
    rig = await createHostRig();
    const r = rig;
    const input = r.server.publish(workerOptions({ sequence: 4 }));
    await r.runner.start(SUBJECT);
    r.runner.noteLatestSequence(4);
    r.gate.set(true);
    await flush(r);

    expect(r.runner.view().phase).toBe('running');
    const reply = await r.workerHost()?.call(ECHO_CAPABILITY, { marker: CAPABILITY_ARGS_MARKER, token: SESSION_TOKEN });
    expect(reply).toBe('pong');
    await r.workerHost()?.call('not.granted', { marker: CAPABILITY_ARGS_MARKER }).catch(() => undefined);
    r.gate.set(false);
    await flush(r);
    r.gate.set(true);
    await flush(r);

    const logs = JSON.stringify(r.log.records);
    const views = JSON.stringify([r.runner.view(), r.views]);
    // What reaches the worker over the capability and init paths; the code port carries the worker's own file.
    const toWorker = JSON.stringify([
      r.fakes.forks.flatMap((fork) => fork.child.posted.map((post) => post.message)),
      r.fakes.channels.filter((_, index) => index % 2 === 0).flatMap((channel) => channel.port1.sent),
    ]);
    expect(r.log.records.map((record) => record['event'])).toContain('premium.capability');

    const bundleText = [...input.files.values()].flatMap(renderings);
    const manifestText = [...renderings(input.manifestBytes), ...renderings(input.sig)];
    const sensitive: Array<[string, string]> = [
      ...SECRET_MARKERS,
      ['capability argument', CAPABILITY_ARGS_MARKER],
      ...[...bundleText, ...manifestText].filter((text) => text.length > 8).map((text): [string, string] => ['bundle bytes', text]),
    ];
    for (const [name, value] of sensitive) {
      expect(logs, `a log record holds the ${name}`).not.toContain(value);
      expect(views, `a view holds the ${name}`).not.toContain(value);
      expect(toWorker, `a message to the worker holds the ${name}`).not.toContain(value);
    }
    expect(JSON.stringify(r.log.records)).not.toContain('args');
  });

  it('gives the worker process a three-variable environment however many secrets the host holds', () => {
    const fakes = createFakeFork();
    const log = createLogSink();
    const supervisor = createWorkerSupervisor({
      fork: fakes.fork,
      createChannel: fakes.createChannel,
      loaderPath: 'premium-worker.cjs',
      vars: {
        SYSTEMROOT: 'C:\\Windows',
        TEMP: 'C:\\Temp',
        TMP: 'C:\\Temp',
        SESSION_TOKEN,
        SIGN_IN_TOKEN,
        DEVICE_PRIVATE_KEY,
        FINGERPRINT_SALT: SALT,
        STEAM_ID: SECRETS.steamId64,
      },
      allowlist: new Map(),
      now: () => 0,
      log,
    });

    supervisor.start({ sequence: 4, version: '1.0.0', workerBytes: new Uint8Array([1, 2, 3]), requested: [] });

    const seen = JSON.stringify([
      fakes.forks.map((fork) => [fork.modulePath, fork.args, fork.options, fork.child.posted.map((post) => post.message)]),
      log.records,
    ]);
    for (const [name, value] of SECRET_MARKERS) {
      expect(seen, `the worker process or a log holds the ${name}`).not.toContain(value);
    }
    expect(Object.keys(fakes.forks[0]?.options.env ?? {}).sort()).toEqual(['SYSTEMROOT', 'TEMP', 'TMP']);
  });
});

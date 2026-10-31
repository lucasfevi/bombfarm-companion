import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { PremiumManifest } from '@bombfarm/contracts';
import { readLocalBundle } from './dev-bundle.js';
import { signedInput } from './host-test-support.js';
import {
  createHostRig,
  flush,
  folders,
  OTHER_SUBJECT,
  SUBJECT,
  topLevel,
  workerOptions,
  type HostRig,
} from './host-service-test-support.js';

let rig: HostRig | null = null;
afterEach(async () => {
  await rig?.dispose();
  rig = null;
});

async function started(options: Parameters<typeof createHostRig>[0] = {}): Promise<HostRig> {
  rig = await createHostRig(options);
  return rig;
}

const files = (r: HostRig): string[] =>
  r.server.requests.map((req) => (req.route.r === 'bundle' ? 'manifest' : `${String(req.route.sequence)}:${req.route.path}`));

describe('downloading a bundle', () => {
  it('sends no request while the gate is closed', async () => {
    const r = await started();
    r.server.publish(workerOptions({ sequence: 4 }));
    await r.runner.start(SUBJECT);
    r.runner.noteLatestSequence(4);
    await flush(r);

    expect(r.server.attempts).toBe(0);
    expect(r.server.requests).toEqual([]);
    expect(r.fakes.forks).toHaveLength(0);
    expect(r.runner.view().phase).toBe('none');
  });

  it('asks for the manifest, then each file, once the gate opens, and runs what it verified', async () => {
    const r = await started();
    r.server.publish(workerOptions({ sequence: 4 }));
    await r.runner.start(SUBJECT);
    r.runner.noteLatestSequence(4);
    r.gate.set(true);
    await flush(r);

    expect(files(r)).toEqual(['manifest', '4:ui/index.css', '4:ui/index.js', '4:worker/index.cjs']);
    expect(await folders(r.root)).toEqual(['4']);
    expect(r.db.rows.get('premium_bundle_seq_v1')).toBe(JSON.stringify({ subject: SUBJECT, sequence: 4 }));
    expect(r.fakes.forks).toHaveLength(1);
    expect(r.workerHost()).toBeDefined();
    expect(r.runner.view()).toEqual({
      phase: 'running',
      uiUrl: 'app://bundle/_premium/4/ui/index.js',
      styleUrl: 'app://bundle/_premium/4/ui/index.css',
      localBuild: false,
    });
    expect(r.runner.runningSequence()).toBe(4);
  });

  it('serves the verified UI from memory once it is active', async () => {
    const r = await started();
    const input = r.server.publish(workerOptions({ sequence: 4 }));
    await r.runner.start(SUBJECT);
    r.runner.noteLatestSequence(4);
    r.gate.set(true);
    await flush(r);

    const served = r.runner.routes.resolve('/_premium/4/ui/index.js');
    expect(Buffer.from(served?.bytes ?? []).equals(Buffer.from(input.files.get('ui/index.js') ?? []))).toBe(true);
    expect(r.runner.routes.resolve('/_premium/4/worker/index.cjs')).toBeNull();
  });

  it('writes nothing when a file answers 500', async () => {
    const r = await started();
    r.server.publish(workerOptions({ sequence: 4 }));
    r.server.failFile = (path) =>
      path === 'ui/index.js' ? { ok: true, status: 500, bytes: new Uint8Array(), retryAfterSec: null } : undefined;
    await r.runner.start(SUBJECT);
    r.runner.noteLatestSequence(4);
    r.gate.set(true);
    await flush(r);

    expect(await topLevel(r.root)).toEqual([]);
    expect(r.db.rows.has('premium_bundle_seq_v1')).toBe(false);
    expect(r.fakes.forks).toHaveLength(0);
    expect(r.runner.view().phase).toBe('updating');
    expect(r.runner.routes.resolve('/_premium/4/ui/index.js')).toBeNull();
  });

  it('does not retry a refused download until the next renewal names a sequence', async () => {
    const r = await started();
    r.server.publish(workerOptions({ sequence: 4 }));
    r.server.manifestReply = { ok: true, status: 500, bytes: new Uint8Array(), retryAfterSec: null };
    await r.runner.start(SUBJECT);
    r.runner.noteLatestSequence(4);
    r.gate.set(true);
    await flush(r);
    await r.clock.advance(3_600_000);
    expect(r.server.requests).toHaveLength(1);

    r.server.manifestReply = null;
    r.runner.noteLatestSequence(4);
    await flush(r);
    expect(await folders(r.root)).toEqual(['4']);
  });

  it('keeps one download in flight and drops a second trigger', async () => {
    const r = await started();
    r.server.publish(workerOptions({ sequence: 4 }));
    await r.runner.start(SUBJECT);
    r.runner.noteLatestSequence(4);
    r.gate.set(true);
    r.runner.noteLatestSequence(4);
    r.runner.noteLatestSequence(4);
    await flush(r);
    expect(r.server.requests.filter((req) => req.route.r === 'bundle')).toHaveLength(1);
  });

  it('shows Updating while nothing fits: a 404 from the resolver, or no sequence named', async () => {
    const r = await started();
    await r.runner.start(SUBJECT);
    r.gate.set(true);
    r.runner.noteLatestSequence(null);
    await flush(r);
    expect(r.server.attempts).toBe(0);
    expect(r.runner.view().phase).toBe('updating');

    r.runner.noteLatestSequence(4);
    await flush(r);
    expect(r.server.requests).toHaveLength(1);
    expect(r.runner.view().phase).toBe('updating');
    expect(await topLevel(r.root)).toEqual([]);
  });

  it('refuses a bundle with a bad signature before asking for any file, and writes nothing', async () => {
    const r = await started();
    r.server.publish(workerOptions({ sequence: 4, keyId: 'AAAAAAAA' }));
    await r.runner.start(SUBJECT);
    r.runner.noteLatestSequence(4);
    r.gate.set(true);
    await flush(r);
    expect(files(r)).toEqual(['manifest']);
    expect(await topLevel(r.root)).toEqual([]);
  });
});

describe('starting with a cache', () => {
  async function seeded(): Promise<HostRig> {
    const first = await createHostRig();
    first.server.publish(workerOptions({ sequence: 4 }));
    await first.runner.start(SUBJECT);
    first.runner.noteLatestSequence(4);
    first.gate.set(true);
    await flush(first);
    first.runner.stop();
    return first;
  }

  it('does not start the worker until the gate is true, and never downloads again', async () => {
    const first = await seeded();
    rig = await createHostRig({ root: first.root, db: first.db });
    await rig.runner.start(SUBJECT);
    rig.runner.noteLatestSequence(4);
    await flush(rig);

    expect(rig.fakes.forks).toHaveLength(0);
    expect(rig.runner.view().phase).toBe('paused');
    expect(rig.server.attempts).toBe(0);

    rig.gate.set(true);
    await flush(rig);
    expect(rig.fakes.forks).toHaveLength(1);
    expect(rig.runner.view().phase).toBe('running');
    expect(rig.server.attempts).toBe(0);
  });

  it('deletes a cached bundle that fails the checks on boot, and only that one', async () => {
    const first = await seeded();
    // A second folder that cannot verify: its files are not the ones its manifest describes.
    const bad = signedInput({ sequence: 5, createdAt: '2026-11-01T00:00:00.000Z' });
    await first.cache.write({
      manifest: JSON.parse(Buffer.from(bad.manifestBytes).toString('utf8')) as PremiumManifest,
      manifestBytes: bad.manifestBytes,
      sig: bad.sig,
      files: bad.files,
    });
    await writeFile(join(first.root, 'premium', '5', 'ui', 'index.js'), 'tampered');
    expect(await folders(first.root)).toEqual(['4', '5']);

    rig = await createHostRig({ root: first.root, db: first.db });
    await rig.runner.start(SUBJECT);
    await flush(rig);
    expect(await folders(rig.root)).toEqual(['4']);
    expect(rig.runner.view().phase).toBe('paused');
  });

  it('runs no other subject’s cache: it is deleted and the record cleared', async () => {
    const first = await seeded();
    rig = await createHostRig({ root: first.root, db: first.db });
    await rig.runner.start(OTHER_SUBJECT);
    await flush(rig);
    expect(await folders(rig.root)).toEqual([]);
    expect(rig.db.rows.has('premium_bundle_seq_v1')).toBe(false);
    expect(rig.runner.view().phase).toBe('none');
  });

  it('does not fetch a sequence it already holds, even one older than the renewal names', async () => {
    const first = await seeded();
    rig = await createHostRig({ root: first.root, db: first.db });
    rig.server.publish(workerOptions({ sequence: 3 }));
    await rig.runner.start(SUBJECT);
    rig.gate.set(true);
    rig.runner.noteLatestSequence(3);
    await flush(rig);
    // 4 is held, which is at least the 3 the renewal names: nothing is asked for.
    expect(rig.server.attempts).toBe(0);
    expect(await folders(rig.root)).toEqual(['4']);
  });
});

describe('who the host works for', () => {
  it('stops the worker and unmounts on sign-out, and keeps the folder', async () => {
    const r = await started();
    r.server.publish(workerOptions({ sequence: 4 }));
    await r.runner.start(SUBJECT);
    r.runner.noteLatestSequence(4);
    r.gate.set(true);
    await flush(r);
    expect(r.runner.view().phase).toBe('running');

    r.runner.signedOut();
    await flush(r);
    expect(r.runner.view()).toEqual({ phase: 'none', uiUrl: null, styleUrl: null, localBuild: false });
    expect(r.fakes.forks[0]?.child.killed).toBe(1);
    expect(await folders(r.root)).toEqual(['4']);
    expect(r.runner.routes.resolve('/_premium/4/ui/index.js')).toBeNull();
  });

  it('does nothing at all when the flavour has no Premium', async () => {
    const r = await started({ enabled: false });
    r.server.publish(workerOptions({ sequence: 4 }));
    await r.runner.start(SUBJECT);
    r.runner.noteLatestSequence(4);
    r.gate.set(true);
    await flush(r);
    expect(r.server.attempts).toBe(0);
    expect(r.fakes.forks).toHaveLength(0);
    expect(r.runner.view().phase).toBe('none');
  });

  it('stops the worker for good when the UI fails to mount', async () => {
    const r = await started();
    r.server.publish(workerOptions({ sequence: 4 }));
    await r.runner.start(SUBJECT);
    r.runner.noteLatestSequence(4);
    r.gate.set(true);
    await flush(r);

    r.runner.mountFailed();
    await flush(r);
    expect(r.runner.view().phase).toBe('stopped');
    expect(r.fakes.forks[0]?.child.killed).toBe(1);
    expect(r.log.records).toContainEqual({ scope: 'premium', event: 'premium.ui_mount', outcome: 'failed' });
    await r.clock.advance(600_000);
    expect(r.fakes.forks).toHaveLength(1);
  });

  it('tells subscribers when the view changes, and not otherwise', async () => {
    const r = await started();
    r.server.publish(workerOptions({ sequence: 4 }));
    await r.runner.start(SUBJECT);
    r.runner.noteLatestSequence(4);
    r.runner.noteLatestSequence(4);
    expect(r.views).toEqual([]);
    r.gate.set(true);
    await flush(r);
    expect(r.views.at(-1)).toBe('running');
    expect(new Set(r.views).size).toBeGreaterThan(0);
  });
});

describe('a local development bundle', () => {
  it('runs without a download or a cache write once the gate is true, and badges the view', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'bfc-host-local-'));
    try {
      const local = signedInput({
        ...workerOptions(),
        edit: (draft) => {
          workerOptions().edit?.(draft);
          draft.manifest['sequence'] = 0;
          draft.manifest['keyId'] = null;
        },
      });
      await writeFile(join(dir, 'manifest.json'), local.manifestBytes);
      for (const [path, bytes] of local.files) {
        await mkdir(dirname(join(dir, path)), { recursive: true });
        await writeFile(join(dir, path), bytes);
      }
      const r = await started({
        localBundle: () => readLocalBundle(dir, { hostApi: '1.0.0', appVersion: '1.0.0', flavor: 'dev' }),
      });
      r.runner.noteLatestSequence(9);
      await r.runner.start(SUBJECT);
      expect(r.runner.view()).toMatchObject({ phase: 'paused', localBuild: true, uiUrl: null });

      r.gate.set(true);
      await flush(r);
      expect(r.runner.view()).toEqual({
        phase: 'running',
        uiUrl: 'app://bundle/_premium/0/ui/index.js',
        styleUrl: 'app://bundle/_premium/0/ui/index.css',
        localBuild: true,
      });
      expect(r.server.attempts).toBe(0);
      expect(await topLevel(r.root)).toEqual([]);
      expect(r.db.rows.size).toBe(0);
      expect(r.runner.runningSequence()).toBeNull();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe('a window on the renderer dev server', () => {
  async function localRig(uiOnAppScheme: boolean): Promise<{ r: HostRig; dir: string }> {
    const dir = await mkdtemp(join(tmpdir(), 'bfc-host-local-'));
    const local = signedInput({
      ...workerOptions(),
      edit: (draft) => {
        workerOptions().edit?.(draft);
        draft.manifest['sequence'] = 0;
        draft.manifest['keyId'] = null;
      },
    });
    await writeFile(join(dir, 'manifest.json'), local.manifestBytes);
    for (const [path, bytes] of local.files) {
      await mkdir(dirname(join(dir, path)), { recursive: true });
      await writeFile(join(dir, path), bytes);
    }
    const r = await started({
      uiOnAppScheme,
      localBundle: () => readLocalBundle(dir, { hostApi: '1.0.0', appVersion: '1.0.0', flavor: 'dev' }),
    });
    return { r, dir };
  }

  it('runs the local build and badges it, but names no address to import', async () => {
    const { r, dir } = await localRig(false);
    try {
      await r.runner.start(SUBJECT);
      r.gate.set(true);
      await flush(r);

      expect(r.runner.view()).toEqual({ phase: 'running', uiUrl: null, styleUrl: null, localBuild: true });
      expect(r.fakes.forks).toHaveLength(1);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('names the address on the app scheme', async () => {
    const { r, dir } = await localRig(true);
    try {
      await r.runner.start(SUBJECT);
      r.gate.set(true);
      await flush(r);

      expect(r.runner.view().uiUrl).toBe('app://bundle/_premium/0/ui/index.js');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

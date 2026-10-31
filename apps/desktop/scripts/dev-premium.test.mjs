import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { BUNDLE_DIR_VAR, buildEnv, buildSteps, bundleDirFrom, launchCommand, launchEnv, runBuild } from './dev-premium.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(path.parse(here).root, 'app', 'desktop');
const FOLDER = path.join(path.parse(here).root, 'local', 'build');

describe('the build environment', () => {
  it('is the dev flavour in production mode, whatever the shell says', () => {
    expect(buildEnv({ PATH: 'x', NODE_ENV: 'development', BFC_FLAVOR: 'beta' })).toEqual({
      PATH: 'x',
      NODE_ENV: 'production',
      BFC_FLAVOR: 'dev',
    });
  });
});

describe('the launch environment', () => {
  it('carries exactly the dev flavour, production mode and the folder of the local build', () => {
    expect(launchEnv({ PATH: 'x', BFC_FLAVOR: 'prod' }, FOLDER)).toEqual({
      PATH: 'x',
      NODE_ENV: 'production',
      BFC_FLAVOR: 'dev',
      [BUNDLE_DIR_VAR]: FOLDER,
    });
  });

  it('drops what would keep the app off the app scheme or stop Electron being an app', () => {
    const env = launchEnv(
      { PATH: 'x', BFC_RENDERER_URL: 'http://127.0.0.1:3000', ELECTRON_RUN_AS_NODE: '1', ELECTRON_NO_ASAR: '1' },
      FOLDER,
    );
    expect(Object.keys(env).sort()).toEqual(['BFC_FLAVOR', BUNDLE_DIR_VAR, 'NODE_ENV', 'PATH'].sort());
  });

  it('starts the unpackaged app from its folder, without a shell', () => {
    const launch = launchCommand({ PATH: 'x' }, FOLDER, ROOT);
    expect(launch.args).toEqual(['.']);
    expect(launch.options).toMatchObject({ shell: false, cwd: ROOT });
    expect(launch.options.env[BUNDLE_DIR_VAR]).toBe(FOLDER);
    expect(path.basename(launch.command).toLowerCase()).toMatch(/^electron(\.exe)?$/);
  });
});

describe('the folder of the local build', () => {
  const cwd = path.join(path.parse(here).root, 'work');

  it('comes from the variable, made absolute', () => {
    expect(bundleDirFrom([], { [BUNDLE_DIR_VAR]: 'out' }, cwd)).toBe(path.join(cwd, 'out'));
  });

  it('comes from --bundle before the variable, in both spellings', () => {
    expect(bundleDirFrom(['--bundle', 'a'], { [BUNDLE_DIR_VAR]: 'b' }, cwd)).toBe(path.join(cwd, 'a'));
    expect(bundleDirFrom(['--bundle=a'], {}, cwd)).toBe(path.join(cwd, 'a'));
  });

  it('is null when nothing names it', () => {
    expect(bundleDirFrom([], {}, cwd)).toBeNull();
    expect(bundleDirFrom([], { [BUNDLE_DIR_VAR]: '  ' }, cwd)).toBeNull();
    expect(bundleDirFrom(['--bundle'], {}, cwd)).toBeNull();
  });
});

describe('the build', () => {
  function recorder(statuses) {
    const calls = [];
    const run = (command, args, options) => {
      calls.push({ command, args, options });
      return { status: statuses[calls.length - 1] ?? 0 };
    };
    return { run, calls };
  }

  it('builds main, then the renderer, then its manifest, each in the dev production environment', () => {
    const { run, calls } = recorder([]);
    const status = runBuild({ PATH: 'x', BFC_FLAVOR: 'prod' }, { run, steps: buildSteps(ROOT, 'node-bin'), cwd: ROOT });

    expect(status).toBe(0);
    expect(calls.map((call) => path.basename(call.args[0]))).toEqual(['build-electron.mjs', 'next', 'write-csp-manifest.mjs']);
    expect(calls[1].args.slice(1)).toEqual(['build', 'renderer']);
    for (const call of calls) {
      expect(call.command).toBe('node-bin');
      expect(call.options.shell).toBe(false);
      expect(call.options.env).toEqual({ PATH: 'x', NODE_ENV: 'production', BFC_FLAVOR: 'dev' });
    }
  });

  it('stops at the first failing step and returns its status', () => {
    const { run, calls } = recorder([0, 3]);
    expect(runBuild({}, { run, steps: buildSteps(ROOT, 'node-bin'), cwd: ROOT })).toBe(3);
    expect(calls).toHaveLength(2);
  });
});

describe('the package script', () => {
  it('is wired in the desktop package and from the repo root', () => {
    const desktop = JSON.parse(readFileSync(path.join(here, '..', 'package.json'), 'utf8'));
    const root = JSON.parse(readFileSync(path.join(here, '..', '..', '..', 'package.json'), 'utf8'));
    expect(desktop.scripts['dev:premium']).toBe('node scripts/dev-premium.mjs');
    expect(root.scripts['dev:premium']).toBe('pnpm --filter @bombfarm/desktop dev:premium');
  });
});

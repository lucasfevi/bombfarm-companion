import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { runElectronBuild } from './dev-build.mjs';

function fakeSpawn(status) {
  const calls = [];
  const spawn = (command, args, options) => {
    calls.push({ command, args, options });
    return { status };
  };
  return { spawn, calls };
}

describe('runElectronBuild', () => {
  it('runs the build script with the launcher flavour, whatever the environment says', () => {
    const { spawn, calls } = fakeSpawn(0);
    const status = runElectronBuild('dev', { spawn, env: { PATH: 'x', BFC_FLAVOR: 'beta' }, execPath: 'node-bin' });
    expect(status).toBe(0);
    expect(calls).toHaveLength(1);
    expect(calls[0].command).toBe('node-bin');
    expect(path.basename(calls[0].args[0])).toBe('build-electron.mjs');
    expect(calls[0].options.env).toEqual({ PATH: 'x', BFC_FLAVOR: 'dev' });
    expect(calls[0].options.shell).toBe(false);
  });

  it('passes the flavour when the environment has none', () => {
    const { spawn, calls } = fakeSpawn(0);
    runElectronBuild('dev', { spawn, env: {}, execPath: 'node-bin' });
    expect(calls[0].options.env.BFC_FLAVOR).toBe('dev');
  });

  it('returns the failing status of the build', () => {
    expect(runElectronBuild('dev', { spawn: fakeSpawn(2).spawn, env: {} })).toBe(2);
  });
});

describe('the dev launcher', () => {
  const dir = path.dirname(fileURLToPath(import.meta.url));

  it('builds with the flavour it resolved, after resolving it', () => {
    const source = readFileSync(path.join(dir, 'dev.mjs'), 'utf8');
    const resolved = source.indexOf('flavor = parsedFlavor');
    const built = source.indexOf('runElectronBuild(flavor)');
    expect(resolved).toBeGreaterThan(-1);
    expect(built).toBeGreaterThan(resolved);
  });

  it('is not preceded by a bare build in the dev script', () => {
    const pkg = JSON.parse(readFileSync(path.join(dir, '..', 'package.json'), 'utf8'));
    expect(pkg.scripts.dev).toBe('node scripts/dev.mjs');
  });
});

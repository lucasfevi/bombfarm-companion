import * as esbuild from 'esbuild';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { electronBundles, flavorDefines, writeBuildInfo } from './electron-bundles.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tempDirs = [];

function makeTempDir() {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'bfc-electron-bundles-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) rmSync(tempDirs.pop(), { recursive: true, force: true });
});

describe('electronBundles flavour defines', () => {
  it.each([
    ['dev', '"dev"', 'true'],
    ['beta', '"beta"', 'false'],
    ['prod', '"prod"', 'false'],
  ])('%s main bundle defines the flavour name and the dev flag', (flavor, name, dev) => {
    const { main } = electronBundles({ src: 'src', dist: 'dist', flavor });
    expect(main.define).toEqual({ __BFC_BUILD_FLAVOR__: name, __BFC_PREMIUM_DEV__: dev });
  });

  it('builds as prod when no flavour is given', () => {
    const { main } = electronBundles({ src: 'src', dist: 'dist' });
    expect(main.define).toEqual(flavorDefines('prod'));
    expect(main.define.__BFC_PREMIUM_DEV__).toBe('false');
  });

  it('leaves the preload bundle without the flavour defines', () => {
    const { preload } = electronBundles({ src: 'src', dist: 'dist', flavor: 'dev' });
    expect(preload.define).toBeUndefined();
  });
});

describe('build-electron flavour resolution', () => {
  function runBuild(flavor) {
    const env = { ...process.env };
    delete env.BFC_FLAVOR;
    if (flavor !== undefined) env.BFC_FLAVOR = flavor;
    return spawnSync(process.execPath, [path.join(__dirname, 'build-electron.mjs')], {
      env,
      encoding: 'utf8',
      shell: false,
    });
  }

  it('exits 1 on a token that is not a flavour, before building anything', () => {
    const result = runBuild('staging');
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Invalid BFC_FLAVOR: staging');
  });
});

describe('build-info.json', () => {
  it('records the flavour the bundles were built for', () => {
    const dist = makeTempDir();
    const file = writeBuildInfo(dist, 'beta');
    expect(file).toBe(path.join(dist, 'main', 'build-info.json'));
    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual({ flavor: 'beta' });
  });
});

describe('dead-code elimination of the dev-only branch', () => {
  const MARKER = 'probe-marker-7f3a91c2';

  async function buildProbe(flavor) {
    const dir = makeTempDir();
    writeFileSync(path.join(dir, 'probe-dev.js'), `module.exports = { marker: '${MARKER}' };\n`);
    writeFileSync(
      path.join(dir, 'entry.js'),
      `let trust = null;\nif (__BFC_PREMIUM_DEV__) {\n  trust = require('./probe-dev.js');\n}\nconsole.log(trust);\n`,
    );
    const { main } = electronBundles({ src: dir, dist: dir, flavor });
    const result = await esbuild.build({
      bundle: true,
      platform: 'node',
      format: 'cjs',
      write: false,
      logLevel: 'silent',
      entryPoints: [path.join(dir, 'entry.js')],
      outfile: path.join(dir, 'out.cjs'),
      define: main.define,
    });
    return result.outputFiles[0].text;
  }

  it.each(['beta', 'prod'])('leaves the probe module out of a %s build', async (flavor) => {
    expect(await buildProbe(flavor)).not.toContain(MARKER);
  });

  it('keeps the probe module in a dev build', async () => {
    expect(await buildProbe('dev')).toContain(MARKER);
  });
});

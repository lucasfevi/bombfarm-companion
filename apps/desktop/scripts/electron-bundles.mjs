import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const MAIN_EXTERNALS = [
  'electron',
  'better-sqlite3',
  'node:sqlite',
  'electron-log',
  'electron-log/main.js',
  'electron-updater',
  '@bombfarm/tap-runtime',
  'frida',
];

/** The only modules a sandboxed preload can `require`; anything else throws when the preload loads. */
export const SANDBOX_PRELOAD_MODULES = ['electron', 'events', 'timers', 'url'];

/**
 * The two build-time constants the main bundle is compiled with. The dev-only flag is a boolean so
 * esbuild drops an `if (__BFC_PREMIUM_DEV__)` body without having to fold a string comparison.
 *
 * @param {import('@bombfarm/contracts').AppFlavor} flavor
 */
export function flavorDefines(flavor) {
  return {
    __BFC_BUILD_FLAVOR__: JSON.stringify(flavor),
    __BFC_PREMIUM_DEV__: String(flavor === 'dev'),
  };
}

/** The flavour a build was made for, written beside the bundles so packaging can compare it. */
export function writeBuildInfo(dist, flavor) {
  const file = path.join(dist, 'main', 'build-info.json');
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify({ flavor })}
`);
  return file;
}

/**
 * @param {{ src: string, dist: string, flavor?: import('@bombfarm/contracts').AppFlavor }} options
 *   `flavor` defaults to `prod`, the same answer an unset `BFC_FLAVOR` gets.
 */
export function electronBundles({ src, dist, flavor = 'prod' }) {
  const shared = {
    bundle: true,
    platform: 'node',
    target: 'node22',
    sourcemap: true,
    format: 'cjs',
    logLevel: 'info',
  };

  return {
    main: {
      ...shared,
      external: MAIN_EXTERNALS,
      define: flavorDefines(flavor),
      entryPoints: [path.join(src, 'main/index.ts')],
      outfile: path.join(dist, 'main/index.cjs'),
    },
    /** The fixed entry the Premium worker process runs; it compiles the bundle's worker from a buffer. */
    worker: {
      ...shared,
      define: flavorDefines(flavor),
      entryPoints: [path.join(src, 'main/premium/host/worker-loader.ts')],
      outfile: path.join(dist, 'main/premium-worker.cjs'),
    },
    preload: {
      ...shared,
      external: ['electron'],
      entryPoints: [path.join(src, 'preload/index.ts')],
      outfile: path.join(dist, 'preload/index.cjs'),
    },
  };
}

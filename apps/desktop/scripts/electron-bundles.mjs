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

export function electronBundles({ src, dist }) {
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
      entryPoints: [path.join(src, 'main/index.ts')],
      outfile: path.join(dist, 'main/index.cjs'),
    },
    preload: {
      ...shared,
      external: ['electron'],
      entryPoints: [path.join(src, 'preload/index.ts')],
      outfile: path.join(dist, 'preload/index.cjs'),
    },
  };
}

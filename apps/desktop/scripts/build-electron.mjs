import * as esbuild from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const src = path.join(root, 'src');
const dist = path.join(root, 'dist');

const shared = {
  bundle: true,
  platform: 'node',
  target: 'node22',
  sourcemap: true,
  external: [
    'electron',
    'better-sqlite3',
    'node:sqlite',
    'electron-log',
    'electron-log/main.js',
    'electron-log/renderer.js',
    'electron-updater',
    '@bombfarm/tap-runtime',
    'frida',
  ],
  logLevel: 'info',
};

await esbuild.build({
  ...shared,
  entryPoints: [path.join(src, 'main/index.ts')],
  outfile: path.join(dist, 'main/index.cjs'),
  format: 'cjs',
});

await esbuild.build({
  ...shared,
  entryPoints: [path.join(src, 'preload/index.ts')],
  outfile: path.join(dist, 'preload/index.cjs'),
  format: 'cjs',
});

console.log('Built Electron main + preload');

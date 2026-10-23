import * as esbuild from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { electronBundles } from './electron-bundles.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const { main, preload } = electronBundles({
  src: path.join(root, 'src'),
  dist: path.join(root, 'dist'),
});

await esbuild.build(main);
await esbuild.build(preload);

console.log('Built Electron main + preload');

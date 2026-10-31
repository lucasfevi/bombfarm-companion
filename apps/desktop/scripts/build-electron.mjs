import * as esbuild from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveBuildFlavor } from '@bombfarm/contracts';
import { electronBundles, writeBuildInfo } from './electron-bundles.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

/** An unset flavour builds `prod`; any other token must be a real one. */
let flavor;
try {
  flavor = resolveBuildFlavor(process.env.BFC_FLAVOR ?? 'prod');
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

const dist = path.join(root, 'dist');
const { main, worker, preload } = electronBundles({ src: path.join(root, 'src'), dist, flavor });

await esbuild.build(main);
await esbuild.build(worker);
await esbuild.build(preload);
writeBuildInfo(dist, flavor);

console.log(`Built Electron main + worker + preload (${flavor})`);

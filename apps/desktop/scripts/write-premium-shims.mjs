import * as esbuild from 'esbuild';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { PREMIUM_SHARED_MODULES } from '@bombfarm/contracts';

/**
 * The names each shared module exports, written for the app's main process to read once. A Premium
 * bundle imports these modules from the app; the shim served for each one re-exports exactly these
 * names from the live module, so a named import in the bundle resolves.
 *
 * `@bombfarm/ui` ships TypeScript source, so its names come from an esbuild metafile; the React
 * entries are plain CommonJS and are read with `Object.keys(require(name))`.
 */

const UI_MODULE = '@bombfarm/ui';
const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

/** Valid export names only, `default` excluded (the shim exports that itself), sorted. */
function cleanNames(names) {
  return [...new Set(names)].filter((name) => name !== 'default' && IDENTIFIER.test(name)).sort();
}

async function uiExports(requireFrom) {
  const entry = requireFrom.resolve(UI_MODULE);
  const result = await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    // Bare imports (react, base-ui, ...) stay out; the package's own files are followed.
    packages: 'external',
    format: 'esm',
    platform: 'neutral',
    write: false,
    metafile: true,
    logLevel: 'silent',
    outdir: 'out',
    loader: { '.css': 'empty' },
  });
  const outputs = Object.values(result.metafile.outputs);
  const exported = outputs.flatMap((output) => output.exports ?? []);
  return cleanNames(exported);
}

/**
 * @param {{ root: string }} options  the desktop package folder; modules resolve from there.
 * @returns {Promise<Record<string, string[]>>} export names by module name, in table order.
 */
export async function premiumShimExports({ root }) {
  const requireFrom = createRequire(path.join(root, 'package.json'));
  const shims = {};
  for (const name of PREMIUM_SHARED_MODULES) {
    shims[name] = name === UI_MODULE ? await uiExports(requireFrom) : cleanNames(Object.keys(requireFrom(name)));
  }
  return shims;
}

/** Writes `dist/main/premium-shims.json` and returns its path. */
export async function writePremiumShims(dist, { root }) {
  const file = path.join(dist, 'main', 'premium-shims.json');
  const shims = await premiumShimExports({ root });
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(shims)}\n`);
  return file;
}

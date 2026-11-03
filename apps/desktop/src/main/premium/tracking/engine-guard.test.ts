import { build } from 'esbuild';
import { join, relative, resolve, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { guardScanner, type FileEntry } from '../../guard-scan';

const DESKTOP_ROOT = resolve(__dirname, '../../../..');
const { readAll } = guardScanner(__filename);

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

/** Files whose code names the DuckDB packages, however they load them. */
function duckdbImporters(files: readonly FileEntry[]): string[] {
  return files.filter((file) => /@duckdb\//.test(stripComments(file.source))).map((file) => file.path);
}

describe('the DuckDB packages have one importer', () => {
  it('scans the app sources', () => {
    const paths = readAll(DESKTOP_ROOT, ['.ts', '.tsx', '.mjs', '.cjs']).map((file) => file.path);
    expect(paths.some((path) => path.endsWith(`${sep}engine.ts`))).toBe(true);
    expect(paths.length).toBeGreaterThan(100);
  });

  it('names the packages only in the engine', () => {
    const sources = readAll(join(DESKTOP_ROOT, 'src'), ['.ts', '.tsx']).concat(
      readAll(join(DESKTOP_ROOT, 'renderer'), ['.ts', '.tsx']),
    );
    expect(duckdbImporters(sources).map((path) => relative(DESKTOP_ROOT, path).split(sep).join('/'))).toEqual([
      'src/main/premium/tracking/engine.ts',
    ]);
  });

  it('catches a second importer, in every way of loading the package', () => {
    const second = (source: string): FileEntry => ({ path: 'other.ts', source });
    expect(duckdbImporters([second("import { DuckDBInstance } from '@duckdb/node-api';")])).toEqual(['other.ts']);
    expect(duckdbImporters([second("const d = require('@duckdb/node-bindings');")])).toEqual(['other.ts']);
    expect(duckdbImporters([second("const d = await import('@duckdb/node-api');")])).toEqual(['other.ts']);
    expect(duckdbImporters([second("import type { DuckDBValue } from '@duckdb/node-api';")])).toEqual(['other.ts']);
    expect(duckdbImporters([second("// the @duckdb/node-api binding\nconst a = 1;")])).toEqual([]);
  });

  it('keeps the packages out of the Premium worker bundle', async () => {
    const result = await build({
      entryPoints: [join(DESKTOP_ROOT, 'src/main/premium/host/worker-loader.ts')],
      bundle: true,
      write: false,
      metafile: true,
      platform: 'node',
      target: 'node22',
      format: 'cjs',
      logLevel: 'silent',
      define: { __BFC_BUILD_FLAVOR__: '"dev"', __BFC_PREMIUM_DEV__: 'true' },
    });
    const inputs = Object.keys(result.metafile.inputs);
    expect(inputs.length).toBeGreaterThan(0);
    expect(inputs.filter((input) => /@duckdb|duckdb/i.test(input) || input.endsWith('tracking/engine.ts'))).toEqual([]);
    expect(result.outputFiles.some((file) => /@duckdb\//.test(file.text))).toBe(false);
  });
});

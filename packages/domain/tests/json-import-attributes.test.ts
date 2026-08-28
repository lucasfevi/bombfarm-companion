/**
 * `tsc` emits this package's JSON imports into `dist/**` exactly as written. Node's own ESM loader
 * rejects one without `with { type: 'json' }`; Vitest's module runner and the bundlers accept it
 * either way. So a bare import costs nothing until something runs `dist` through plain Node — which
 * is how the committed derived fixtures drifted for two weeks: the one documented command that
 * regenerates them could not run outside the test harness, so nobody ran it.
 */
import { readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { listFiles } from './helpers/list-files';

const SRC_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
const JSON_IMPORT = /\bfrom\s+'[^']+\.json'(?<attribute>\s+with\s*\{\s*type:\s*'json'\s*\})?/g;

describe('every JSON import in src carries its import attribute', () => {
  const sources = listFiles(SRC_DIR, (name) => name.endsWith('.ts'));

  it('non-vacuity: the walk finds source files, and at least one imports JSON', () => {
    expect(sources.length, `walked ${SRC_DIR}`).toBeGreaterThan(0);
    const withJson = sources.filter((f) => /\bfrom\s+'[^']+\.json'/.test(readFileSync(f, 'utf8')));
    expect(withJson.length, 'source files importing JSON').toBeGreaterThan(0);
  });

  it('no bare JSON import survives — plain Node would reject it out of dist', () => {
    const offenders: string[] = [];
    for (const file of sources) {
      for (const match of readFileSync(file, 'utf8').matchAll(JSON_IMPORT)) {
        if (!match.groups?.attribute) {
          offenders.push(`${relative(SRC_DIR, file).replace(/\\/g, '/')}: ${match[0].trim()}`);
        }
      }
    }
    expect(offenders, `JSON imports missing \`with { type: 'json' }\`:\n${offenders.join('\n')}`).toEqual([]);
  });
});

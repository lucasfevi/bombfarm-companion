/**
 * `live-source.ts` is the one file the rest of the app may see into `live-source/` — everything
 * else there (the attach loop, the frame decoder, the TLS demultiplexer, the injected agent, the
 * PE scanner, the hook cache, the runtime port) is an implementation detail. This guard fails the
 * moment anything outside that directory imports one of those internals directly instead of going
 * through the seam.
 *
 * Comments are stripped before scanning — several of these modules describe their own boundary in
 * doc comments (this file included), and a bare substring match would flag that prose as a
 * violation of the rule it documents.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { extname, join, resolve, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

const DESKTOP_ROOT = resolve(__dirname, '../..');
const LIVE_SOURCE_DIR = join(DESKTOP_ROOT, 'src', 'main', 'live-source');
const SELF_PATH = __filename;

const INTERNAL_MODULE_STEMS = ['tap', 'agent', 'runtime', 'ws-frame', 'tls-stream', 'image-scan', 'hook-cache'] as const;

type FileEntry = { path: string; source: string };

function walk(dir: string, extensions: readonly string[]): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (
        entry.name === 'node_modules' ||
        entry.name === 'out' ||
        entry.name === 'dist' ||
        entry.name === '.next' ||
        entry.name === '.next-dev'
      )
        continue;
      files.push(...walk(full, extensions));
    } else if (entry.isFile() && extensions.includes(extname(entry.name))) {
      files.push(full);
    }
  }
  return files;
}

function readOutsideLiveSource(): FileEntry[] {
  return walk(DESKTOP_ROOT, ['.ts', '.tsx'])
    .filter((path) => path !== SELF_PATH)
    .filter((path) => !path.startsWith(LIVE_SOURCE_DIR + sep))
    .map((path) => ({ path, source: readFileSync(path, 'utf8') }));
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

function importsInternalModule(source: string, stem: string): boolean {
  const pattern = new RegExp(`\\/${stem}\\.js['"\`]`);
  return pattern.test(stripComments(source));
}

describe('live-source seam boundary — only live-source.ts crosses out', () => {
  for (const stem of INTERNAL_MODULE_STEMS) {
    it(`nothing outside live-source/ imports ${stem}.js`, () => {
      const offenders = readOutsideLiveSource()
        .filter((file) => importsInternalModule(file.source, stem))
        .map((file) => file.path);
      expect(
        offenders,
        `Found an import of ${stem}.js outside apps/desktop/src/main/live-source/ in: ${offenders.join(', ')}. ` +
          `Only live-source.ts is allowed to see this module — everything else must go through the seam.`,
      ).toEqual([]);
    });
  }

  it('red state demonstrated: a fixture importing tap.js directly is caught', () => {
    const fixtureSource = "import { Tap } from '../live-source/tap.js';";
    expect(importsInternalModule(fixtureSource, 'tap')).toBe(true);
  });

  it('red state demonstrated: the same import written inside a comment is not caught', () => {
    const fixtureSource = "// import { Tap } from '../live-source/tap.js';";
    expect(importsInternalModule(fixtureSource, 'tap')).toBe(false);
  });

  it('live-source.ts itself is allowed to import the internals it composes', () => {
    const seamSource = readFileSync(join(LIVE_SOURCE_DIR, 'live-source.ts'), 'utf8');
    expect(importsInternalModule(seamSource, 'tap')).toBe(true);
    expect(importsInternalModule(seamSource, 'runtime')).toBe(true);
  });
});

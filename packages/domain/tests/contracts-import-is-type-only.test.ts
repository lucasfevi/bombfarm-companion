// Architectural guard (design.md Risks row 4): `@bombfarm/contracts` must be imported
// type-only everywhere under packages/domain/src. `apps/web/next.config.ts`'s
// `transpilePackages` lists only `@bombfarm/domain` and `@bombfarm/ui` — a runtime
// (value) import of `@bombfarm/contracts` from domain source would resolve to an
// unbuilt `dist/index.js` and break the Vercel production build. Type-only imports
// are erased at build time, so they carry no runtime resolution at all.
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const SRC_DIR = join(here, '..', 'src');

function listTsFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listTsFiles(full));
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      files.push(full);
    }
  }
  return files;
}

// Isolates one `import`/`export ... from '@bombfarm/contracts';` statement at a time.
// Anchored to the start of a line (`^[ \t]*`) so prose inside a comment that merely
// contains the word "import" (e.g. "F3/F4 import this without...") can never seed a
// false match — only an actual import/export keyword starting a line qualifies.
// `[^;]*?` cannot cross a preceding statement's terminating semicolon, and the whole
// pattern is non-greedy, so multi-line import lists are matched without bleeding into
// an unrelated statement. Capture group 2 is present iff the statement is `type`-only.
const CONTRACTS_IMPORT_RE = /^[ \t]*(import|export)\s+(type\s+)?[^;]*?from\s+['"]@bombfarm\/contracts['"];/gms;

describe('domain -> @bombfarm/contracts import shape', () => {
  it('imports @bombfarm/contracts as `import type` everywhere under packages/domain/src', () => {
    const offenders: string[] = [];
    for (const file of listTsFiles(SRC_DIR)) {
      const content = readFileSync(file, 'utf8');
      for (const match of content.matchAll(CONTRACTS_IMPORT_RE)) {
        const isTypeOnly = match[2] !== undefined;
        if (!isTypeOnly) {
          offenders.push(file);
        }
      }
    }

    const message =
      offenders.length > 0
        ? `Found a value (non-"import type") import of @bombfarm/contracts in: ${offenders.join(', ')}. ` +
          `apps/web/next.config.ts's transpilePackages does not list @bombfarm/contracts, so a runtime ` +
          `import from packages/domain/src resolves to an unbuilt dist/index.js and breaks the Vercel ` +
          `production build. Change it to "import type".`
        : 'no offenders';
    expect(offenders, message).toEqual([]);
  });
});

import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * W6-12 / MOD-28 — at most one React component declaration per `.tsx` file.
 * Stories excluded. Namespace `index.ts` files are not scanned (not components).
 *
 * Component = PascalCase `function` declaration, or PascalCase `const` bound to
 * `memo(` / `forwardRef(`.
 */
const SRC_ROOT = path.resolve(__dirname, '..');

const FN_DECL =
  /^(?:export\s+)?function\s+([A-Z][A-Za-z0-9]*)\b/gm;
const MEMO_CONST =
  /^(?:export\s+)?const\s+([A-Z][A-Za-z0-9]*)\s*=\s*(?:memo|forwardRef)\s*\(/gm;

function walk(dir: string, acc: string[] = []): string[] {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory() && ent.name !== 'node_modules') {
      walk(p, acc);
    } else if (ent.name.endsWith('.tsx') && !ent.name.includes('.stories.')) {
      acc.push(p);
    }
  }
  return acc;
}

function componentNames(src: string): string[] {
  const names = new Set<string>();
  for (const re of [FN_DECL, MEMO_CONST]) {
    re.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = re.exec(src))) {
      const name = match[1];
      if (name) names.add(name);
    }
  }
  return [...names].sort();
}

describe('one component per file (MOD-28)', () => {
  it('prints an empty offender list', () => {
    const offenders: { file: string; names: string[] }[] = [];

    for (const abs of walk(SRC_ROOT)) {
      const src = fs.readFileSync(abs, 'utf8');
      const names = componentNames(src);
      if (names.length > 1) {
        offenders.push({
          file: path.relative(path.resolve(SRC_ROOT, '..'), abs).replaceAll('\\', '/'),
          names,
        });
      }
    }

    expect(offenders).toEqual([]);
  });
});

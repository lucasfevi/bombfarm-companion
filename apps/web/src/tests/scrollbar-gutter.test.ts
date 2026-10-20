import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * The document reserves its scrollbar gutter so a panel growing past the viewport mid-animation
 * cannot narrow the content and reflow it. The rule ships in the design system's opt-in
 * stylesheet; the web only gets it by importing that stylesheet, so the effective outcome is
 * checked by walking the `@import` graph from `globals.css`.
 */
const here = dirname(fileURLToPath(import.meta.url));
const globalsCss = resolve(here, '../app/globals.css');
const uiRoot = resolve(here, '../../../../packages/ui');

function resolveImport(specifier: string, fromFile: string): string | undefined {
  if (specifier.startsWith('.')) return resolve(dirname(fromFile), specifier);
  const prefix = '@bombfarm/ui/';
  if (!specifier.startsWith(prefix)) return undefined;
  const pkg = JSON.parse(readFileSync(resolve(uiRoot, 'package.json'), 'utf8')) as {
    exports: Record<string, string>;
  };
  const target = pkg.exports[`./${specifier.slice(prefix.length)}`];
  return target ? resolve(uiRoot, target) : undefined;
}

function reachableCss(entry: string): string[] {
  const seen = new Set<string>();
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.pop() as string;
    if (seen.has(file) || !existsSync(file)) continue;
    seen.add(file);
    const css = readFileSync(file, 'utf8');
    for (const match of css.matchAll(/@import\s+['"]([^'"]+)['"]/g)) {
      const next = resolveImport(match[1], file);
      if (next) queue.push(next);
    }
  }
  return [...seen];
}

describe('document scrollbar gutter', () => {
  it('the document keeps a stable scrollbar gutter', () => {
    const rule = /(^|[}\s])html\s*\{[^}]*scrollbar-gutter\s*:\s*stable\s*;?[^}]*\}/;
    const withRule = reachableCss(globalsCss).filter((file) =>
      rule.test(readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')),
    );
    expect(withRule).not.toEqual([]);
  });
});

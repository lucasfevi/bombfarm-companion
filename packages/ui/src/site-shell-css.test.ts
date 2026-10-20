import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const srcDir = path.dirname(fileURLToPath(import.meta.url));
const readCss = (name: string) =>
  readFileSync(path.join(srcDir, name), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

const gutterRule = /(^|\})\s*html\s*\{[^}]*scrollbar-gutter:\s*stable\s*;?[^}]*\}/;

describe('site-shell.css', () => {
  it('reserves the root scrollbar gutter with an html rule', () => {
    expect(readCss('site-shell.css')).toMatch(gutterRule);
  });

  it('is the only stylesheet that carries the rule, so the shared styles leave the desktop untouched', () => {
    expect(readCss('styles.css')).not.toMatch(/scrollbar-gutter:\s*stable/);
  });
});

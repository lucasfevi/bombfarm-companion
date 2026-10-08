import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const RENDERER_ROOT = join(__dirname, '..');

describe('renderer production code names no currency of its own', () => {
  // A quote fetched in the chosen currency lands under that key in `lowestNative`; a screen that
  // resolves prices with a literal code would never read it. The literal belongs to the setting's
  // default in the contracts package, nowhere in this tree.
  it("no 'BRL' literal outside tests", () => {
    const offenders: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) && /['"]BRL['"]/.test(readFileSync(full, 'utf8')))
          offenders.push(relative(RENDERER_ROOT, full));
      }
    };
    walk(RENDERER_ROOT);
    expect(offenders).toEqual([]);
  });
});

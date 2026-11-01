import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const RENDERER = path.resolve(__dirname, '..', '..');

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'node_modules' || entry.name.startsWith('.') ? [] : sources(full);
    return /\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

const files = sources(RENDERER);
const rel = (file: string) => path.relative(RENDERER, file).split(path.sep).join('/');
const naming = (needle: string) => files.filter((file) => readFileSync(file, 'utf8').includes(needle)).map(rel);

describe('Premium UI has one way in', () => {
  it('imports a bundle address only in the mount point', () => {
    expect(naming('webpackIgnore')).toEqual(['app/premium/premium-mount.tsx']);
  });

  it('names the shared-module table only where it is built', () => {
    expect(naming('__bfcPremiumShared')).toEqual(['lib/premium/shared-modules.ts']);
  });

  it('loads the table from the mount point alone', () => {
    expect(naming('premium/shared-modules')).toEqual(['app/premium/premium-mount.tsx']);
  });

  it('names the capability channel only in the bridge', () => {
    expect(naming('premium:uiCall')).toEqual(['lib/premium/premium-bridge.ts']);
  });

  it('imports the bridge from the mount point alone', () => {
    expect(naming('premium/premium-bridge')).toEqual(['app/premium/premium-mount.tsx']);
  });
});

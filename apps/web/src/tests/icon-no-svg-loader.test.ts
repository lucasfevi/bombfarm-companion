import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = resolve(__dirname, '../../../..');
const iconModuleRoot = resolve(repoRoot, 'packages/ui/src/icon');

const bundlerConfigs = [
  resolve(repoRoot, 'apps/web/next.config.ts'),
  resolve(repoRoot, 'apps/desktop/renderer/next.config.ts'),
  resolve(repoRoot, 'packages/ui/.storybook/main.ts'),
] as const;

const svgLoaderPattern = /svgr|@svgr\/webpack|\.svg['"`]/;

const runtimeFetchPattern = /\bfetch\(|<img\b|new Image\(/;
const networkUrlPattern = /https?:\/\//;

function readConfigOrFail(path: string): string {
  if (!existsSync(path)) {
    throw new Error(`Expected bundler config missing: ${path}`);
  }
  return readFileSync(path, 'utf8');
}

function listSourceFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listSourceFiles(fullPath));
      continue;
    }
    if (/\.(ts|tsx)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

describe('icon pipeline has no bundler SVG loader', () => {
  it('does not configure svgr or an .svg loader in apps/web/next.config.ts', () => {
    const source = readConfigOrFail(bundlerConfigs[0]);
    expect(source).not.toMatch(svgLoaderPattern);
  });

  it('does not configure svgr or an .svg loader in apps/desktop/renderer/next.config.ts', () => {
    const source = readConfigOrFail(bundlerConfigs[1]);
    expect(source).not.toMatch(svgLoaderPattern);
  });

  it('does not configure svgr or an .svg loader in packages/ui/.storybook/main.ts', () => {
    const source = readConfigOrFail(bundlerConfigs[2]);
    expect(source).not.toMatch(svgLoaderPattern);
  });

  it('does not fetch or image-load icons under packages/ui/src/icon', () => {
    const runtimeOffenders: string[] = [];
    const networkOffenders: string[] = [];
    for (const file of listSourceFiles(iconModuleRoot)) {
      const source = readFileSync(file, 'utf8');
      const relative = file.replace(`${repoRoot}\\`, '').replace(`${repoRoot}/`, '');
      if (runtimeFetchPattern.test(source)) {
        runtimeOffenders.push(relative);
      }
      if (networkUrlPattern.test(source)) {
        networkOffenders.push(relative);
      }
    }
    expect(runtimeOffenders).toEqual([]);
    expect(networkOffenders).toEqual([]);
  });
});

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const srcDir = path.dirname(fileURLToPath(import.meta.url));
const packageDir = path.resolve(srcDir, '..');
const repoRoot = path.resolve(packageDir, '../..');
const consumerDir = path.join(repoRoot, 'apps', 'web');
const PACKAGE = '@bombfarm/ui';

const manifest = JSON.parse(readFileSync(path.join(packageDir, 'package.json'), 'utf8')) as {
  sideEffects?: unknown;
  exports: Record<string, unknown>;
};

const requireFromConsumer = createRequire(path.join(consumerDir, 'package.json'));

function resolveThroughExports(specifier: string): string | undefined {
  try {
    return requireFromConsumer.resolve(specifier);
  } catch {
    return undefined;
  }
}

function resolveThroughTypeScript(specifier: string): string | undefined {
  const { resolvedModule } = ts.resolveModuleName(
    specifier,
    path.join(consumerDir, 'src', 'index.ts'),
    { moduleResolution: ts.ModuleResolutionKind.Bundler, module: ts.ModuleKind.ESNext },
    ts.sys,
  );
  return resolvedModule?.resolvedFileName;
}

function publicModuleSpecifiers(): string[] {
  const specifiers: string[] = [];
  for (const entry of readdirSync(srcDir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (existsSync(path.join(srcDir, entry.name, 'index.ts'))) {
        specifiers.push(`${PACKAGE}/${entry.name}`);
      }
      continue;
    }
    const match = /^(.+)\.tsx?$/.exec(entry.name);
    if (!match || match[1] === 'index') continue;
    if (/\.(test|stories)\.tsx?$/.test(entry.name) || entry.name === 'dom-test-harness.ts') continue;
    specifiers.push(`${PACKAGE}/${match[1]}`);
  }
  return specifiers;
}

function specifiersImportedByConsumers(): string[] {
  const files = execFileSync(
    'git',
    ['ls-files', '-z', '--', 'apps/**/*.ts', 'apps/**/*.tsx', 'apps/**/*.mjs', 'apps/**/*.css', 'packages/**/*.ts', 'packages/**/*.tsx', 'packages/**/*.mjs', 'packages/**/*.css'],
    { cwd: repoRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  )
    .split('\0')
    .filter(Boolean);
  const importPattern = /(?:from|import)\s*\(?\s*['"](@bombfarm\/ui\/[^'"]+)['"]/g;
  const found = new Set<string>();
  for (const file of files) {
    const text = readFileSync(path.join(repoRoot, file), 'utf8');
    for (const match of text.matchAll(importPattern)) found.add(match[1] as string);
  }
  return [...found];
}

const publicSpecifiers = [
  ...new Set([
    `${PACKAGE}/styles.css`,
    `${PACKAGE}/site-shell.css`,
    `${PACKAGE}/site-address`,
    ...publicModuleSpecifiers(),
    ...specifiersImportedByConsumers(),
  ]),
].sort();

function listFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === 'node_modules') return [];
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? listFiles(file) : [file];
  });
}

describe('@bombfarm/ui package.json sideEffects', () => {
  it('lists only CSS files, so every module can be tree-shaken', () => {
    const { sideEffects } = manifest;
    expect(Array.isArray(sideEffects)).toBe(true);
    const entries = sideEffects as string[];
    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries) expect(entry.endsWith('.css'), entry).toBe(true);
  });

  it('matches every stylesheet in the source tree and only existing files', () => {
    const patterns = (manifest.sideEffects as string[]).map((entry) => {
      const normalized = entry.replace(/^\.\//, '');
      return normalized.includes('/') ? normalized : `**/${normalized}`;
    });
    const relativeFiles = (dir: string) =>
      listFiles(dir).map((file) => path.relative(packageDir, file).split(path.sep).join('/'));
    const matches = (file: string, pattern: string) => path.posix.matchesGlob(file, pattern);
    const stylesheets = relativeFiles(srcDir).filter((file) => file.endsWith('.css'));
    expect(stylesheets.length).toBeGreaterThan(0);
    expect(stylesheets.filter((file) => !patterns.some((pattern) => matches(file, pattern)))).toEqual([]);
    const allFiles = relativeFiles(packageDir);
    expect(patterns.filter((pattern) => !allFiles.some((file) => matches(file, pattern)))).toEqual([]);
  });
});

describe('@bombfarm/ui exports map', () => {
  it('enumerates the specifiers that must resolve', () => {
    expect(publicSpecifiers.length).toBeGreaterThan(60);
    expect(publicSpecifiers).toContain(`${PACKAGE}/panel-field.recipe`);
    expect(publicSpecifiers).toContain(`${PACKAGE}/accordion`);
    expect(publicSpecifiers).toContain(`${PACKAGE}/styles.css`);
    expect(publicSpecifiers).toContain(`${PACKAGE}/site-shell.css`);
  });

  it.each(publicSpecifiers)('resolves %s to an existing file with an extension', (specifier) => {
    const resolved = resolveThroughExports(specifier);
    expect(resolved, `${specifier} did not resolve through the exports map`).toBeDefined();
    expect(path.extname(resolved as string)).not.toBe('');
    expect(existsSync(resolved as string)).toBe(true);
    expect(path.relative(srcDir, resolved as string).startsWith('..')).toBe(false);
  });

  it.each(publicSpecifiers.filter((specifier) => !specifier.endsWith('.css')))(
    'resolves %s through TypeScript bundler resolution without tsconfig paths',
    (specifier) => {
      const resolved = resolveThroughTypeScript(specifier);
      expect(resolved, `${specifier} did not resolve for TypeScript`).toBeDefined();
      expect(path.relative(srcDir, resolved as string).startsWith('..')).toBe(false);
    },
  );

  it('reports a specifier with no matching entry as unresolved', () => {
    expect(resolveThroughExports(`${PACKAGE}/no-such-module`)).toBeUndefined();
    expect(resolveThroughTypeScript(`${PACKAGE}/no-such-module`)).toBeUndefined();
  });

  it.each(['app-nav.test', 'app-nav.stories', 'dom-test-harness', 'accordion/accordion-root'])(
    'does not export the internal file %s',
    (internal) => {
      expect(resolveThroughExports(`${PACKAGE}/${internal}`)).toBeUndefined();
    },
  );

  it('points every entry at a file that exists and carries its extension', () => {
    for (const [key, target] of Object.entries(manifest.exports)) {
      const files =
        typeof target === 'string' ? [target] : Object.values(target as Record<string, string>);
      for (const file of files) {
        expect(path.extname(file), `${key} -> ${file}`).not.toBe('');
        expect(existsSync(path.join(packageDir, file)), `${key} -> ${file}`).toBe(true);
      }
    }
  });

  it('has an entry for every public source module', () => {
    const missing = publicModuleSpecifiers().filter((specifier) => resolveThroughExports(specifier) === undefined);
    expect(missing).toEqual([]);
  });
});

import { existsSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC_ROOT = dirname(fileURLToPath(import.meta.url));
const ENTRY = resolve(SRC_ROOT, 'index.ts');

const IMPORT_SPECIFIER = /(?:import|export)\s+(?:type\s+)?(?:[^'";]*?\s+from\s+)?['"]([^'"]+)['"]/g;

interface NodeBuiltinImport {
  readonly module: string;
  readonly specifier: string;
}

function resolveRelativeSpecifier(fromFile: string, specifier: string): string | undefined {
  if (!specifier.startsWith('.')) return undefined;
  const resolved = resolve(dirname(fromFile), specifier);
  return resolved.endsWith('.js') ? `${resolved.slice(0, -'.js'.length)}.ts` : resolved;
}

function walkModuleGraph(entry: string): {
  readonly visited: ReadonlySet<string>;
  readonly nodeBuiltinImports: readonly NodeBuiltinImport[];
} {
  const visited = new Set<string>();
  const nodeBuiltinImports: NodeBuiltinImport[] = [];
  const queue: string[] = [entry];

  while (queue.length > 0) {
    const file = queue.pop();
    if (!file || visited.has(file) || file.endsWith('.test.ts')) continue;
    if (!existsSync(file)) {
      throw new Error(`[module-graph] resolved an import to a file that does not exist on disk: ${file}`);
    }
    visited.add(file);

    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(IMPORT_SPECIFIER)) {
      const specifier = match[1];
      if (!specifier) continue;
      if (specifier.startsWith('node:')) {
        nodeBuiltinImports.push({ module: relative(SRC_ROOT, file), specifier });
        continue;
      }
      const resolved = resolveRelativeSpecifier(file, specifier);
      if (resolved && !visited.has(resolved)) queue.push(resolved);
    }
  }

  return { visited, nodeBuiltinImports };
}

describe('packages/game-api barrel — no node: builtin reaches the renderer bundle', () => {
  const { visited, nodeBuiltinImports } = walkModuleGraph(ENTRY);

  it('non-vacuity: the walk from index.ts actually reaches more than a handful of modules', () => {
    expect(visited.size).toBeGreaterThan(5);
  });

  it('no module reachable from index.ts imports a node: builtin', () => {
    const message = nodeBuiltinImports
      .map(
        ({ module, specifier }) =>
          `${module} imports "${specifier}" — packages/game-api/src/index.ts is the barrel pulled into ` +
          "apps/desktop's browser-side renderer bundle, and a node: specifier fails that build.",
      )
      .join('\n');
    expect(nodeBuiltinImports, message).toEqual([]);
  });
});

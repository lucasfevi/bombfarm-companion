import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isIpcChannel } from '@bombfarm/contracts';
import { guardScanner } from './guard-scan';
import { MINI_LIVE_INVOKE_CHANNELS } from './ipc-sender-policy';

const DESKTOP_ROOT = resolve(__dirname, '../..');
const PACKAGES_ROOT = resolve(DESKTOP_ROOT, '../../packages');
const MINI_LIVE_ENTRIES = [
  join(DESKTOP_ROOT, 'renderer', 'app', 'mini-live', 'page.tsx'),
  join(DESKTOP_ROOT, 'renderer', 'app', 'layout.tsx'),
];

const { readAll } = guardScanner(__filename);

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

function importSpecifiersOf(source: string): string[] {
  const specifiers: string[] = [];
  const pattern = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(['"])([^'"]+)\1/g;
  for (const match of stripComments(source).matchAll(pattern)) {
    specifiers.push(match[2] as string);
  }
  return specifiers;
}

function collectInvokes(source: string): { channels: string[]; unresolvable: number } {
  const code = stripComments(source);
  const channels: string[] = [];
  let unresolvable = 0;
  for (const match of code.matchAll(/\binvoke\b/g)) {
    const index = match.index;
    const quotedTypeName = /['"`]/.test(code[index - 1] ?? '') && /['"`]/.test(code[index + 6] ?? '');
    if (quotedTypeName) continue;
    const literalCall = /^invoke\s*\(\s*(['"])([A-Za-z0-9:_.-]+)\1\s*[,)]/.exec(code.slice(index));
    if (literalCall) {
      channels.push(literalCall[2] as string);
    } else {
      unresolvable += 1;
    }
  }
  return { channels, unresolvable };
}

function resolveRelative(fromFile: string, specifier: string): string | null {
  const base = resolve(dirname(fromFile), specifier);
  const candidates = [`${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx'), base];
  return candidates.find((candidate) => /\.tsx?$/.test(candidate) && existsSync(candidate)) ?? null;
}

interface Reach {
  files: string[];
  packages: string[];
  unresolved: string[];
}

function reachFrom(entries: readonly string[]): Reach {
  const files = new Set<string>();
  const packages = new Set<string>();
  const unresolved: string[] = [];
  const queue = [...entries];
  while (queue.length > 0) {
    const file = queue.pop() as string;
    if (files.has(file)) continue;
    files.add(file);
    for (const specifier of importSpecifiersOf(readFileSync(file, 'utf8'))) {
      if (specifier.startsWith('.')) {
        if (/\.(css|json|svg|png)$/.test(specifier)) continue;
        const target = resolveRelative(file, specifier);
        if (target === null) unresolved.push(`${file} -> ${specifier}`);
        else queue.push(target);
      } else if (specifier.startsWith('@/')) {
        unresolved.push(`${file} -> ${specifier}`);
      } else if (specifier.startsWith('@bombfarm/')) {
        packages.add(specifier.split('/')[1] as string);
      }
    }
  }
  return { files: [...files].sort(), packages: [...packages].sort(), unresolved };
}

describe('compact Live window channel allowlist', () => {
  const reach = reachFrom(MINI_LIVE_ENTRIES);
  const collected = reach.files.map((file) => ({ file, ...collectInvokes(readFileSync(file, 'utf8')) }));

  it('reaches the page and its layout through imports the walk can follow', () => {
    expect(reach.unresolved).toEqual([]);
    expect(reach.files.length).toBeGreaterThan(MINI_LIVE_ENTRIES.length);
    expect(reach.files.some((file) => file.endsWith(join('lib', 'live', 'live-store.ts')))).toBe(true);
  });

  it('calls every channel with a literal name, so the channel set is knowable from source', () => {
    expect(collected.filter((entry) => entry.unresolvable > 0).map((entry) => entry.file)).toEqual([]);
  });

  it('allows exactly the channels the window can reach, no more and no fewer', () => {
    const called = [...new Set(collected.flatMap((entry) => entry.channels))].sort();
    expect(called).toEqual([...MINI_LIVE_INVOKE_CHANNELS].sort());
  });

  it('allows only channels the contract defines', () => {
    expect([...MINI_LIVE_INVOKE_CHANNELS].filter((channel) => !isIpcChannel(channel))).toEqual([]);
  });

  it('reaches no workspace package that touches the bridge itself', () => {
    const offenders = reach.packages.flatMap((name) =>
      readAll(join(PACKAGES_ROOT, name), ['.ts', '.tsx'])
        .filter((entry) => /\bipcRenderer\b|\.bfc\b|\bbfc\??\.(?:invoke|on)\b/.test(stripComments(entry.source)))
        .map((entry) => entry.path),
    );
    expect(offenders).toEqual([]);
  });
});

describe('collectInvokes', () => {
  it('reads a literal call, including one split across lines', () => {
    expect(collectInvokes("bridge.invoke('live:get');").channels).toEqual(['live:get']);
    expect(collectInvokes("bridge\n  .invoke(\n 'settings:get')").channels).toEqual(['settings:get']);
    expect(collectInvokes('bridge.invoke("miniLive:setLayout", patch)').channels).toEqual(['miniLive:setLayout']);
  });

  it('counts a call whose channel is not a plain literal as unresolvable', () => {
    expect(collectInvokes('bridge.invoke(channel)').unresolvable).toBe(1);
    expect(collectInvokes('bridge.invoke(`forge:${name}`)').unresolvable).toBe(1);
    expect(collectInvokes('const { invoke } = bridge;').unresolvable).toBe(1);
    expect(collectInvokes('run(bridge.invoke)').unresolvable).toBe(1);
  });

  it('ignores the word in prose and in a quoted type name', () => {
    expect(collectInvokes("// bridge.invoke('forge:run')\n/* invoke(x) */").channels).toEqual([]);
    expect(collectInvokes("type Bridge = Pick<Bfc, 'invoke' | 'on'>;")).toEqual({ channels: [], unresolvable: 0 });
  });
});

describe('importSpecifiersOf', () => {
  it('reads static, side-effect, re-export and dynamic imports', () => {
    const source = [
      "import { a } from './a';",
      "import type { B } from '../b';",
      "import './c.css';",
      "export * from './d';",
      "const e = await import('./e');",
    ].join('\n');
    expect(importSpecifiersOf(source)).toEqual(['./a', '../b', './c.css', './d', './e']);
  });
});

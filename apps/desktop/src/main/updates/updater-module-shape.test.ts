import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/** `__dirname`, not `import.meta.url`: `tsconfig.main.json` builds this tree to CommonJS. */
const DESKTOP_ROOT = resolve(__dirname, '../../..');

/**
 * Node's own loader, not Vite's. `loadUpdaterPort` runs inside the bundled CommonJS main, where
 * the `import('electron-updater')` survives verbatim and is served by Node's ESM loader — so the
 * namespace it sees is the one a child `node` process sees, and nothing the test runner resolves.
 */
function readUpdaterModuleShape(): { namespaceKeys: string[]; onModuleExports: boolean } {
  const probe = [
    "const namespace = await import('electron-updater');",
    'process.stdout.write(',
    '  JSON.stringify({',
    '    namespaceKeys: Object.keys(namespace),',
    "    onModuleExports: 'autoUpdater' in namespace.default,",
    '  }),',
    ');',
  ].join('\n');

  return JSON.parse(
    execFileSync(process.execPath, ['--input-type=module', '-e', probe], {
      cwd: DESKTOP_ROOT,
      encoding: 'utf8',
    }),
  ) as { namespaceKeys: string[]; onModuleExports: boolean };
}

const shape = readUpdaterModuleShape();

describe('electron-updater as the bundled main sees it', () => {
  it('leaves autoUpdater out of the ESM namespace, so a named binding reads undefined', () => {
    expect(shape.namespaceKeys).not.toContain('autoUpdater');
  });

  it('still carries every other export as a named binding', () => {
    expect(shape.namespaceKeys).toContain('NsisUpdater');
    expect(shape.namespaceKeys).toContain('AppUpdater');
  });

  it('keeps autoUpdater on module.exports, which is what default binds to', () => {
    expect(shape.onModuleExports).toBe(true);
  });
});

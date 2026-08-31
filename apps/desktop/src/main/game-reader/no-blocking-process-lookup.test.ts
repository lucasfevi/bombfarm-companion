import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// `__dirname`, not `import.meta.url`: this project builds to CommonJS, where the meta-property is
// a compile error rather than a runtime one.
const serviceSource = readFileSync(path.join(__dirname, 'game-reader-service.ts'), 'utf8');
const processSource = readFileSync(path.join(__dirname, 'process.ts'), 'utf8');

/**
 * A blocking process lookup on the game reader's poll is the defect that made a dragged window
 * stick and lurch: `powershell -NoProfile Get-Process` costs ~166ms with Electron's single-threaded
 * main process stopped inside it, and that poll runs every 50ms while the game is connected. The
 * window message loop is on that thread, so the drag froze in step with it.
 *
 * It reached production because the rule against it was a doc comment sitting four lines above the
 * call site that broke it. This is that rule with teeth. It reads the source rather than the
 * behaviour on purpose: the two are indistinguishable from the outside — the status is identical
 * either way — so nothing observable would fail if the blocking form came back.
 */
describe('the game reader may not block the main process to find the game', () => {
  it('does not reach for the blocking PowerShell helper', () => {
    expect(serviceSource).not.toContain('runPowerShellSync');
  });

  it('uses the awaited lookup — so the assertion above cannot pass by looking nothing up at all', () => {
    expect(serviceSource).toContain('findProcessIdAsync');
    expect(serviceSource).toContain('await findProcessIdAsync(');
  });

  it('verifies a pid it already holds instead of looking it up again', () => {
    expect(serviceSource).toContain('isProcessAlive(this.gamePid)');
  });

  it('offers no synchronous process lookup for anything to call', () => {
    // `runPowerShellSync` itself stays — one-shot callers (reading a process image once per
    // attach) are what it is for. What must not exist is a synchronous way to FIND a process,
    // because that is the one every recurring caller wants.
    expect(processSource).not.toMatch(/export function findProcessId\b/);
    expect(processSource).toContain('export async function findProcessIdAsync');
  });
});

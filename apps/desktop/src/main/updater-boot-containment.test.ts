/**
 * `bootstrap()` builds the update service last, and `boot.failed` quits the app — so an updater
 * that throws while being constructed closes a build that is otherwise entirely usable. That has
 * happened once, to every installed flavor at the same time.
 *
 * The containment is a `try`/`catch` inside a module-level async function with no exported hook
 * to call, so this guard reads the source, the same approach the consent-ordering guard in this
 * directory already takes. Comments are stripped first, since the prose above the construction
 * site could otherwise satisfy a bare substring match in place of the code.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/** `__dirname`, not `import.meta.url`: `tsconfig.main.json` builds this tree to CommonJS. */
const INDEX_PATH = resolve(__dirname, 'index.ts');

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/** The tail of `bootstrap()`, from the last step before the updater to the end of the function. */
function bootstrapTail(source: string): string {
  const start = source.indexOf("event: 'account-refresh.started'");
  expect(start).toBeGreaterThan(-1);
  const end = source.indexOf('\nfunction resolveBootEnv', start);
  expect(end).toBeGreaterThan(-1);
  return source.slice(start, end);
}

describe('a failing updater cannot take down boot', () => {
  const tail = bootstrapTail(stripComments(readFileSync(INDEX_PATH, 'utf8')));

  it('constructs the update service inside a try, so the throw never reaches boot.failed', () => {
    const tryStart = tail.indexOf('try {');
    const construction = tail.indexOf('createElectronUpdateService(');
    const catchStart = tail.indexOf('} catch');

    expect(tryStart).toBeGreaterThan(-1);
    expect(construction).toBeGreaterThan(tryStart);
    expect(catchStart).toBeGreaterThan(construction);
  });

  it('starts the service inside that same try, since start() runs the first schedule', () => {
    const start = tail.indexOf('updateService.start()');
    const catchStart = tail.indexOf('} catch');

    expect(start).toBeGreaterThan(-1);
    expect(start).toBeLessThan(catchStart);
  });

  it('answers with the stand-in service, so the Updates section reports the failure', () => {
    const catchBody = tail.slice(tail.indexOf('} catch'));

    expect(catchBody).toContain('unavailableUpdateService(');
    expect(catchBody).toContain("event: 'updates.unavailable'");
  });

  it('pushes the settled status on BOTH paths, not only the failing one', () => {
    const emit = tail.indexOf("emitEvent('updates:changed', updateService.getStatus())");
    const catchClose = tail.indexOf('}', tail.indexOf('unavailableUpdateService('));

    expect(emit).toBeGreaterThan(-1);
    // Inside the catch it would fire only when construction threw, and the success path — the
    // one every installed build takes — would leave the renderer holding the answer main gave
    // before this service existed.
    expect(emit).toBeGreaterThan(catchClose);
  });
});

/**
 * The window opens before the service is built, and the renderer reads `updates:get` exactly
 * once, on mount. `disabledUpdateStatus` as that gap's answer is not a harmless placeholder:
 * the Updates section disables its own check button on `disabled`, so an installed player was
 * shown "updates are off in this build" with no control to disprove it.
 */
describe('the answer given before the service exists', () => {
  const source = stripComments(readFileSync(INDEX_PATH, 'utf8'));

  it('derives from the flavor, so it cannot claim a build that updates does not', () => {
    expect(source).toContain('function preServiceUpdateStatus()');
    expect(source).toContain('initialUpdateStatus({');
  });

  it('is what every updates channel falls back to', () => {
    const channels = ['updates:get', 'updates:check', 'updates:download', 'updates:installOnRestart'];

    for (const channel of channels) {
      const at = source.indexOf(`'${channel}':`);
      expect(at).toBeGreaterThan(-1);
      expect(source.slice(at, source.indexOf(`'market:`, at))).toContain('preServiceUpdateStatus()');
    }
  });

  it('never answers disabled outright — that is a claim about the build, not about readiness', () => {
    expect(source).not.toContain('disabledUpdateStatus');
  });
});

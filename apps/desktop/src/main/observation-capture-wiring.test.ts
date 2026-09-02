/**
 * The recorder's gate is only as good as what `index.ts` hands it, and `bootstrap()` is a
 * module-level function with no exported hook to call and assert against — so this reads the
 * source, the same approach the consent-revoke and live-source boundary guards in this directory
 * already take.
 *
 * Comments are stripped before scanning, since prose above the construction site could otherwise
 * satisfy a bare substring match in place of the code.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const INDEX_PATH = resolve(__dirname, 'index.ts');

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/** The body between a `name({` construction and its matching closing `});`. */
function constructionBody(source: string, opening: string): string {
  const start = source.indexOf(opening);
  expect(start).toBeGreaterThan(-1);
  const end = source.indexOf('});', start);
  expect(end).toBeGreaterThan(-1);
  return source.slice(start, end);
}

function beforeQuitBody(source: string): string {
  const start = source.indexOf("app.on('before-quit'");
  expect(start).toBeGreaterThan(-1);
  return source.slice(start);
}

describe('the developer observation capture is wired to the real packaged flag', () => {
  const source = stripComments(readFileSync(INDEX_PATH, 'utf8'));

  it('asks the gate with the app environment answer, never a literal and never an environment read', () => {
    const construction = constructionBody(source, 'createObservationCapture({');

    expect(construction).toContain('enabled: isObservationCaptureEnabled(process.env, resolveAppEnv().isPackaged)');
    expect(construction).toContain('isPackaged: resolveAppEnv().isPackaged');
    expect(construction).not.toContain('isPackaged: false');
    expect(construction).not.toContain('isPackaged: true');
    expect(construction).not.toMatch(/isPackaged:\s*process\.env/);
  });

  it('threads the same real flag into the live source, so the frame capture stops relying on its default', () => {
    const construction = constructionBody(source, 'new LiveSource({');

    expect(construction).toContain('isPackaged: resolveAppEnv().isPackaged');
    expect(construction).toContain('observer: observationCapture');
  });

  it('threads the frame port into the replay factory, so an offline run records wire frames too', () => {
    const construction = constructionBody(source, 'createReplayTapFactory({');

    expect(construction).toContain('onObservedFrame');
    expect(construction).toContain('observationCapture?.frame(wire, atMs)');
  });

  it('closes the recorder inside the quit handler, after the live source is torn down', () => {
    const body = beforeQuitBody(source);
    const teardownAt = body.indexOf('liveSource?.teardown()');
    const closeAt = body.indexOf('observationCapture?.close()');

    expect(teardownAt).toBeGreaterThan(-1);
    expect(closeAt).toBeGreaterThan(teardownAt);
    expect(closeAt).toBeLessThan(body.indexOf('accountStore'));
  });
});

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { SHUTDOWN_STEPS, shutdownInOrder, type ShutdownStep } from './shutdown.js';

interface Recording {
  ran: ShutdownStep[];
  failures: { step: ShutdownStep; error: string }[];
}

function runShutdown(throwingSteps: Partial<Record<ShutdownStep, string>> = {}): Recording {
  const ran: ShutdownStep[] = [];
  const failures: { step: ShutdownStep; error: string }[] = [];
  const steps = Object.fromEntries(
    SHUTDOWN_STEPS.map((step) => [
      step,
      () => {
        ran.push(step);
        const message = throwingSteps[step];
        if (message !== undefined) {
          throw new Error(message);
        }
      },
    ]),
  ) as Record<ShutdownStep, () => void>;

  shutdownInOrder({
    steps,
    onStepFailed: (step, error) => {
      failures.push({ step, error: String(error) });
    },
  });

  return { ran, failures };
}

function ranBefore(ran: readonly ShutdownStep[], earlier: ShutdownStep, later: ShutdownStep): boolean {
  const earlierAt = ran.indexOf(earlier);
  const laterAt = ran.indexOf(later);
  return earlierAt > -1 && laterAt > -1 && earlierAt < laterAt;
}

const COMMITTING_PRODUCERS: ShutdownStep[] = ['stopGameReader', 'stopAccountRefresh'];
const STORE_CLOSES: ShutdownStep[] = ['closeStorage', 'closeAccountStore'];

describe('shutdownInOrder runs every declared step', () => {
  it('runs all of them, naming any that did not', () => {
    const { ran } = runShutdown();
    const missing = SHUTDOWN_STEPS.filter((step) => !ran.includes(step));

    expect(missing).toEqual([]);
  });

  it('runs each one exactly once', () => {
    const { ran } = runShutdown();
    const repeated = SHUTDOWN_STEPS.filter(
      (step) => ran.filter((seen) => seen === step).length !== 1,
    );

    expect(repeated).toEqual([]);
  });

  it('reports no failure when no step throws', () => {
    expect(runShutdown().failures).toEqual([]);
  });
});

describe('the quit order every committing producer depends on', () => {
  const { ran } = runShutdown();

  it('stops every producer that can commit before either store handle is closed', () => {
    const late = COMMITTING_PRODUCERS.flatMap((producer) =>
      STORE_CLOSES.filter((close) => !ranBefore(ran, producer, close)).map(
        (close) => `${producer} did not run before ${close}`,
      ),
    );

    expect(late).toEqual([]);
  });

  it('tears the live source down before the observation recorder it writes to is closed', () => {
    expect(ranBefore(ran, 'teardownLiveSource', 'closeObservationCapture')).toBe(true);
  });

  it('stops the marker watch before the recorder it feeds is closed', () => {
    expect(ranBefore(ran, 'stopObservationMarkWatch', 'closeObservationCapture')).toBe(true);
  });

  it('persists the window layout before clearing the timers that would re-schedule it', () => {
    expect(ranBefore(ran, 'persistMainWindowLayout', 'clearLayoutPersistTimer')).toBe(true);
    expect(ranBefore(ran, 'persistMainWindowLayout', 'clearMiniLayoutPersistTimer')).toBe(true);
  });

  it('flushes the log last, so every step above can still be recorded', () => {
    expect(ran.at(-1)).toBe('flushLog');
  });
});

describe('a throwing step does not take the rest of shutdown with it', () => {
  it('runs every remaining step after an early producer stop throws', () => {
    const { ran } = runShutdown({ stopUpdateService: 'stop threw' });
    const missing = SHUTDOWN_STEPS.filter((step) => !ran.includes(step));

    expect(missing).toEqual([]);
  });

  it('still closes both stores and flushes the log when an earlier step throws', () => {
    const { ran } = runShutdown({ teardownLiveSource: 'teardown threw' });

    expect(ran).toContain('closeStorage');
    expect(ran).toContain('closeAccountStore');
    expect(ran.at(-1)).toBe('flushLog');
  });

  it('hands the failure to the caller with the step that raised it, rather than swallowing it', () => {
    const { failures } = runShutdown({ closeStorage: 'database is not open' });

    expect(failures).toHaveLength(1);
    expect(failures[0]?.step).toBe('closeStorage');
    expect(failures[0]?.error).toContain('database is not open');
  });

  it('reports every failing step when more than one throws', () => {
    const { failures } = runShutdown({ stopGameReader: 'a', closeAccountStore: 'b' });

    expect(failures.map((failure) => failure.step)).toEqual(['stopGameReader', 'closeAccountStore']);
  });

  it('keeps the order intact when a step throws, rather than skipping ahead', () => {
    const { ran } = runShutdown({ stopGameReader: 'reader threw' });

    expect(ran).toEqual([...SHUTDOWN_STEPS]);
  });
});

/**
 * The order above is only worth what the bodies bound to those names actually do, and the quit
 * handler is wired inside a module-level function with no exported hook — so the binding itself is
 * read from the source.
 */
describe('the step bodies the quit handler binds to the names the order is asserted on', () => {
  const source = readFileSync(resolve(__dirname, 'index.ts'), 'utf8');

  const expectedCall: Partial<Record<ShutdownStep, string>> = {
    stopGameReader: 'gameReader?.stop()',
    stopAccountRefresh: 'accountRefresh?.stop()',
    teardownLiveSource: 'liveSource?.teardown()',
    stopObservationMarkWatch: 'observationMarkWatch?.stop()',
    closeObservationCapture: 'observationCapture?.close()',
    persistMainWindowLayout: 'persistMainWindowLayout(true)',
    clearLayoutPersistTimer: 'clearTimeout(layoutPersistTimer)',
    clearMiniLayoutPersistTimer: 'clearTimeout(miniLayoutPersistTimer)',
    closeStorage: 'storage?.close()',
    closeAccountStore: 'accountStore?.close()',
    flushLog: 'log.flush()',
  };

  function stepBody(step: ShutdownStep): string {
    const match = new RegExp(`\\n\\s*${step}: \\(\\) => \\{([\\s\\S]*?)\\n\\s*\\},`).exec(source);
    return match?.[1] ?? '';
  }

  it('calls what each name says it calls', () => {
    const wrong = Object.entries(expectedCall)
      .filter(([step, call]) => !stepBody(step as ShutdownStep).includes(call))
      .map(([step, call]) => `${step} does not call ${call}`);

    expect(wrong).toEqual([]);
  });

  it('supplies a body for every declared step, so none is silently dropped', () => {
    const unbound = SHUTDOWN_STEPS.filter((step) => !new RegExp(`\\n\\s*${step}: \\(\\) => \\{`).test(source));

    expect(unbound).toEqual([]);
  });
});

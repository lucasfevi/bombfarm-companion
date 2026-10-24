import { EventEmitter } from 'node:events';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  createViolationLog,
  failIfViolations,
  guardEachTest,
  guardWorkerEnd,
  REPORT_VIOLATIONS_FROM_PAGE,
  VIOLATION_MARKER,
} from '../tests/smoke/csp-guard.mjs';

const smokeDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'tests', 'smoke');
const specs = readdirSync(smokeDir).filter((file) => file.endsWith('.spec.mjs'));
const read = (file) => readFileSync(path.join(smokeDir, file), 'utf8');

describe('the Electron smoke specs', () => {
  it('finds the specs it guards', () => {
    expect(specs.length).toBeGreaterThan(30);
  });

  it.each(specs)('%s launches Electron through the helper that fails the test on a CSP violation', (spec) => {
    const source = read(spec);
    expect(source).toMatch(/from '\.\/smoke-test\.mjs'/);
    expect(source).not.toMatch(/from '@playwright\/test'/);
    expect(source).not.toMatch(/_electron/);
  });

  it('are all listed in the electron-smoke project, which only runs what it names', () => {
    const config = readFileSync(path.join(smokeDir, '..', '..', 'playwright.config.ts'), 'utf8');
    const unlisted = specs.filter((spec) => !config.includes(`'${spec}'`));
    expect(unlisted).toEqual([]);
  });
});

describe('the helper the specs launch through', () => {
  const helper = read('smoke-test.mjs');

  it('wires the per-test and the worker-scoped guards as auto fixtures over one shared log', () => {
    expect(helper).toMatch(/csp: \[async \(\{\}, use\) => guardEachTest\(use, violations\), \{ auto: true \}\]/);
    expect(helper).toMatch(/guardWorkerEnd\(use, violations\), \{ scope: 'worker', auto: true \}/);
    expect(helper).toContain('violations.launchWatched');
  });
});

const CSP_CONSOLE_ERROR = 'Refused to load the script because it violates the following Content Security Policy directive';

function fakeConsoleMessage(text) {
  return { text: () => text };
}

function fakeWindow({ url = 'app://bundle/index.html', earlier = [], workers = [] } = {}) {
  const window = new EventEmitter();
  window.url = () => url;
  window.workers = () => workers;
  window.evaluate = () => Promise.resolve();
  window.consoleMessages = () => Promise.resolve(earlier);
  return window;
}

function fakeWorker(url = 'app://bundle/worker.js') {
  const worker = new EventEmitter();
  worker.url = () => url;
  return worker;
}

describe('failIfViolations', () => {
  it('passes an empty list and fails a list with anything in it, naming each entry', () => {
    expect(() => failIfViolations([], 'headline')).not.toThrow();
    expect(() => failIfViolations(['a :: one', 'b :: two'], 'headline')).toThrow(/headline\na :: one\nb :: two/);
  });
});

describe('the per-test guard', () => {
  it('fails the test when a violation is left unclaimed after it', async () => {
    const log = createViolationLog();
    const window = fakeWindow();
    log.watchWindow(window);
    const use = () => {
      window.emit('console', fakeConsoleMessage(CSP_CONSOLE_ERROR));
      return Promise.resolve();
    };
    await expect(guardEachTest(use, log)).rejects.toThrow(/a window broke its Content-Security-Policy[\s\S]*Refused to load/);
  });

  it('passes a test that claimed what it provoked', async () => {
    const log = createViolationLog();
    const window = fakeWindow();
    log.watchWindow(window);
    const use = ({ takeViolations }) => {
      window.emit('console', fakeConsoleMessage(CSP_CONSOLE_ERROR));
      expect(takeViolations()).toHaveLength(1);
      return Promise.resolve();
    };
    await expect(guardEachTest(use, log)).resolves.toBeUndefined();
  });

  it('passes a test during which nothing was reported', async () => {
    const log = createViolationLog();
    log.watchWindow(fakeWindow());
    await expect(guardEachTest(() => Promise.resolve(), log)).resolves.toBeUndefined();
  });
});

describe('the worker-end guard', () => {
  it('fails the worker on a violation nobody claimed', async () => {
    const log = createViolationLog();
    const window = fakeWindow();
    log.watchWindow(window);
    window.emit('console', fakeConsoleMessage(CSP_CONSOLE_ERROR));
    await expect(guardWorkerEnd(() => Promise.resolve(), log)).rejects.toThrow(/after the last test/);
  });

  it('passes when nothing is left', async () => {
    await expect(guardWorkerEnd(() => Promise.resolve(), createViolationLog())).resolves.toBeUndefined();
  });
});

describe('the violation log', () => {
  it('keeps a window\'s CSP console errors and the page-armed event marker, and nothing else', () => {
    const log = createViolationLog();
    const window = fakeWindow();
    log.watchWindow(window);
    window.emit('console', fakeConsoleMessage('an ordinary log line'));
    window.emit('console', fakeConsoleMessage(CSP_CONSOLE_ERROR));
    window.emit('console', fakeConsoleMessage(`${VIOLATION_MARKER}{"directive":"script-src-elem"}`));
    expect(log.take()).toEqual([
      `app://bundle/index.html :: ${CSP_CONSOLE_ERROR}`,
      `app://bundle/index.html :: ${VIOLATION_MARKER}{"directive":"script-src-elem"}`,
    ]);
    expect(log.take()).toEqual([]);
  });

  it('recovers violations a window logged before it was watched', async () => {
    const log = createViolationLog();
    log.watchWindow(fakeWindow({ earlier: [fakeConsoleMessage(CSP_CONSOLE_ERROR)] }));
    await new Promise((resolve) => setImmediate(resolve));
    expect(log.take()).toHaveLength(1);
  });

  it('keeps the console errors of a worker that starts later, and of one already running', () => {
    const log = createViolationLog();
    const running = fakeWorker('app://bundle/running.js');
    const window = fakeWindow({ workers: [running] });
    log.watchWindow(window);
    const later = fakeWorker('app://bundle/later.js');
    window.emit('worker', later);
    running.emit('console', fakeConsoleMessage(CSP_CONSOLE_ERROR));
    later.emit('console', fakeConsoleMessage(CSP_CONSOLE_ERROR));
    later.emit('console', fakeConsoleMessage('worker says hello'));
    expect(log.take()).toEqual([
      `worker app://bundle/running.js :: ${CSP_CONSOLE_ERROR}`,
      `worker app://bundle/later.js :: ${CSP_CONSOLE_ERROR}`,
    ]);
  });

  it('watches the windows an app already has and the ones it opens afterwards, and arms the init script', async () => {
    const log = createViolationLog();
    const first = fakeWindow({ url: 'app://bundle/first' });
    const app = new EventEmitter();
    const installed = [];
    app.windows = () => [first];
    app.context = () => ({ addInitScript: (script) => installed.push(script) });

    const returned = await log.launchWatched(() => Promise.resolve(app), {});
    const second = fakeWindow({ url: 'app://bundle/second' });
    app.emit('window', second);
    first.emit('console', fakeConsoleMessage(CSP_CONSOLE_ERROR));
    second.emit('console', fakeConsoleMessage(CSP_CONSOLE_ERROR));

    expect(returned).toBe(app);
    expect(installed).toEqual([REPORT_VIOLATIONS_FROM_PAGE]);
    expect(log.take().map((entry) => entry.split(' :: ')[0])).toEqual(['app://bundle/first', 'app://bundle/second']);
  });

  it('arms the page-side event listener on the document a window already has', () => {
    const log = createViolationLog();
    const window = fakeWindow();
    const evaluated = [];
    window.evaluate = (script) => {
      evaluated.push(script);
      return Promise.resolve();
    };
    log.watchWindow(window);
    expect(evaluated).toEqual([REPORT_VIOLATIONS_FROM_PAGE]);
    expect(REPORT_VIOLATIONS_FROM_PAGE).toContain("'securitypolicyviolation'");
  });
});

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

function fakeCdpSession() {
  const session = new EventEmitter();
  session.sent = [];
  session.send = (method, params) => {
    session.sent.push({ method, params });
    return Promise.resolve({});
  };
  session.sentToTargets = () =>
    session.sent
      .filter((call) => call.method === 'Target.sendMessageToTarget')
      .map((call) => ({ sessionId: call.params.sessionId, method: JSON.parse(call.params.message).method }));
  return session;
}

function fakeWindow({ url = 'app://bundle/index.html', earlier = [], session = fakeCdpSession() } = {}) {
  const window = new EventEmitter();
  window.url = () => url;
  window.evaluate = () => Promise.resolve();
  window.consoleMessages = () => Promise.resolve(earlier);
  window.context = () => ({ newCDPSession: () => Promise.resolve(session) });
  return window;
}

const settle = () => new Promise((resolve) => setImmediate(resolve));

const fromTarget = (sessionId, payload) => ({ sessionId, message: JSON.stringify(payload) });
const logEntry = (text) => ({ method: 'Log.entryAdded', params: { entry: { source: 'security', level: 'error', text } } });
const exception = (description) => ({
  method: 'Runtime.exceptionThrown',
  params: { exceptionDetails: { text: 'Uncaught', exception: { description } } },
});

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

  describe('workers, watched over CDP because Playwright\'s worker console carries only console calls', () => {
    const attach = (session, sessionId, url) =>
      session.emit('Target.attachedToTarget', { sessionId, targetInfo: { type: 'worker', url } });

    async function watched() {
      const session = fakeCdpSession();
      const log = createViolationLog();
      await log.watchWindow(fakeWindow({ session }));
      return { log, session };
    }

    it('asks to be told about every child target, and to hold each one until it is ready', async () => {
      const { session } = await watched();
      expect(session.sent).toContainEqual({
        method: 'Target.setAutoAttach',
        params: { autoAttach: true, waitForDebuggerOnStart: true, flatten: false },
      });
    });

    it('turns on Log and Runtime for a worker and then always lets it run', async () => {
      const { session } = await watched();
      attach(session, 'w1', 'app://bundle/worker.js');
      await settle();
      expect(session.sentToTargets()).toEqual([
        { sessionId: 'w1', method: 'Log.enable' },
        { sessionId: 'w1', method: 'Runtime.enable' },
        { sessionId: 'w1', method: 'Runtime.runIfWaitingForDebugger' },
      ]);
    });

    it('still lets the worker run when enabling its domains fails', async () => {
      const { session } = await watched();
      const send = session.send;
      session.send = (method, params) =>
        method === 'Target.sendMessageToTarget' && JSON.parse(params.message).method === 'Log.enable'
          ? Promise.reject(new Error('target gone'))
          : send(method, params);
      attach(session, 'w1', 'app://bundle/worker.js');
      await settle();
      expect(session.sentToTargets().map((call) => call.method)).toContain('Runtime.runIfWaitingForDebugger');
    });

    it('keeps a worker\'s refused load and its uncaught refused eval, named by the worker\'s url', async () => {
      const { log, session } = await watched();
      attach(session, 'w1', 'app://bundle/worker.js');
      const refusedFetch = "Refused to connect to 'https://x.invalid/' because it violates the following Content Security Policy directive";
      const refusedEval = "EvalError: Refused to evaluate a string as JavaScript because 'unsafe-eval' is not an allowed source of script in the following Content Security Policy directive";
      session.emit('Target.receivedMessageFromTarget', fromTarget('w1', logEntry(refusedFetch)));
      session.emit('Target.receivedMessageFromTarget', fromTarget('w1', exception(refusedEval)));
      expect(log.take()).toEqual([`worker app://bundle/worker.js :: ${refusedFetch}`, `worker app://bundle/worker.js :: ${refusedEval}`]);
    });

    it('ignores a worker\'s ordinary log entries, exceptions and malformed messages', async () => {
      const { log, session } = await watched();
      attach(session, 'w1', 'app://bundle/worker.js');
      session.emit('Target.receivedMessageFromTarget', fromTarget('w1', logEntry('a deprecation notice')));
      session.emit('Target.receivedMessageFromTarget', fromTarget('w1', exception('TypeError: x is not a function')));
      session.emit('Target.receivedMessageFromTarget', { sessionId: 'w1', message: '{not json' });
      expect(log.take()).toEqual([]);
    });
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

export const VIOLATION_MARKER = '__bfc_csp_violation__';

export const REPORT_VIOLATIONS_FROM_PAGE = `
if (!window.__bfcReportsViolations) {
  window.__bfcReportsViolations = true;
  document.addEventListener(
    'securitypolicyviolation',
    (event) => {
      console.error(
        '${VIOLATION_MARKER}' +
          JSON.stringify({
            directive: event.effectiveDirective,
            blocked: event.blockedURI,
            source: event.sourceFile,
            sample: event.sample,
          }),
      );
    },
    true,
  );
}
`;

export function isViolation(text) {
  return text.includes(VIOLATION_MARKER) || /Content Security Policy/i.test(text);
}

export function failIfViolations(violations, headline) {
  if (violations.length > 0) {
    throw new Error(`${headline}\n${violations.join('\n')}`);
  }
}

function parseTargetMessage(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/**
 * A worker has no document to arm a `securitypolicyviolation` listener on, and Playwright's own
 * worker console carries only `console.*` calls, not the browser's "Refused to…" log entries. So
 * the worker targets are attached over CDP directly. A worker is held until its `Log` and
 * `Runtime` domains are on, so a violation in its first lines is not lost; it is always resumed.
 * A refused `eval` writes no log entry in a worker, only an exception, which is why uncaught
 * exceptions are read too.
 */
async function watchWorkerTargets(window, record) {
  const session = await window.context().newCDPSession(window);
  const urls = new Map();
  const send = (sessionId, id, method) =>
    session.send('Target.sendMessageToTarget', { sessionId, message: JSON.stringify({ id, method }) });

  session.on('Target.attachedToTarget', ({ sessionId, targetInfo }) => {
    urls.set(sessionId, targetInfo.url);
    void (async () => {
      try {
        await send(sessionId, 1, 'Log.enable');
        await send(sessionId, 2, 'Runtime.enable');
      } catch {
        // the target went away; there is nothing left to hold
      } finally {
        await send(sessionId, 3, 'Runtime.runIfWaitingForDebugger').catch(() => undefined);
      }
    })();
  });

  session.on('Target.receivedMessageFromTarget', ({ sessionId, message }) => {
    const { method, params } = parseTargetMessage(message);
    const text =
      method === 'Log.entryAdded'
        ? params.entry.text
        : method === 'Runtime.exceptionThrown'
          ? (params.exceptionDetails.exception?.description ?? params.exceptionDetails.text)
          : '';
    if (isViolation(text ?? '')) record(`worker ${urls.get(sessionId) ?? sessionId}`, text);
  });

  await session.send('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: true, flatten: false });
}

/** Collects what every window and every worker of every app a spec launched reports. */
export function createViolationLog() {
  const unreported = [];

  const record = (source, text) => {
    unreported.push(`${source} :: ${text}`);
  };

  const recorder = (describeSource) => (message) => {
    const text = message.text();
    if (isViolation(text)) record(describeSource(), text);
  };

  /**
   * The first window may have loaded before this runs: `consoleMessages()` recovers what it
   * already logged, and the evaluate arms the event listener on the document it already has. The
   * launch-time init script covers each document after that.
   */
  async function watchWindow(window) {
    const onConsole = recorder(() => window.url());
    window.on('console', onConsole);
    void window.evaluate(REPORT_VIOLATIONS_FROM_PAGE).catch(() => undefined);
    void window
      .consoleMessages()
      .then((earlier) => {
        earlier.forEach(onConsole);
      })
      .catch(() => undefined);
    await watchWorkerTargets(window, record).catch(() => undefined);
  }

  async function launchWatched(launchElectron, options) {
    const app = await launchElectron(options);
    await app.context().addInitScript(REPORT_VIOLATIONS_FROM_PAGE);
    await Promise.all(app.windows().map(watchWindow));
    app.on('window', watchWindow);
    return app;
  }

  return { launchWatched, watchWindow, take: () => unreported.splice(0) };
}

/** The body of the per-test auto fixture: whatever the test left unclaimed fails it. */
export async function guardEachTest(use, log) {
  await use({ takeViolations: log.take });
  failIfViolations(log.take(), 'a window broke its Content-Security-Policy');
}

/** The body of the worker-scoped fixture: what the last test, or an after-all hook, left behind. */
export async function guardWorkerEnd(use, log) {
  await use();
  failIfViolations(log.take(), 'a Content-Security-Policy violation after the last test');
}

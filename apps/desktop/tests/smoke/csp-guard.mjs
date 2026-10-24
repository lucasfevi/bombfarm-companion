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

/**
 * Collects what every window and every worker of every app a spec launched reports. A window's
 * violation is both a `securitypolicyviolation` event and a console error; a worker has no page
 * to arm an event listener on, so its console error is the only signal it gives.
 */
export function createViolationLog() {
  const unreported = [];

  const recorder = (describeSource) => (message) => {
    const text = message.text();
    if (isViolation(text)) unreported.push(`${describeSource()} :: ${text}`);
  };

  function watchWorker(worker) {
    worker.on('console', recorder(() => `worker ${worker.url()}`));
  }

  /**
   * The first window may have loaded before this runs: `consoleMessages()` recovers what it
   * already logged, and the evaluate arms the event listener on the document it already has. The
   * launch-time init script covers each document after that.
   */
  function watchWindow(window) {
    const record = recorder(() => window.url());
    window.on('console', record);
    window.on('worker', watchWorker);
    window.workers().forEach(watchWorker);
    void window.evaluate(REPORT_VIOLATIONS_FROM_PAGE).catch(() => undefined);
    void window
      .consoleMessages()
      .then((earlier) => {
        earlier.forEach(record);
      })
      .catch(() => undefined);
  }

  async function launchWatched(launchElectron, options) {
    const app = await launchElectron(options);
    await app.context().addInitScript(REPORT_VIOLATIONS_FROM_PAGE);
    app.windows().forEach(watchWindow);
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

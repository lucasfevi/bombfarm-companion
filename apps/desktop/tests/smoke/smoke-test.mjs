import { test as base, expect, _electron } from '@playwright/test';

const VIOLATION_MARKER = '__bfc_csp_violation__';

const REPORT_VIOLATIONS_FROM_PAGE = `
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

const unreported = [];

function isViolation(text) {
  return text.includes(VIOLATION_MARKER) || /Content Security Policy/i.test(text);
}

function watchWindow(window) {
  const record = (message) => {
    const text = message.text();
    if (isViolation(text)) unreported.push(`${window.url()} :: ${text}`);
  };
  window.on('console', record);
  void window.evaluate(REPORT_VIOLATIONS_FROM_PAGE).catch(() => undefined);
  void window
    .consoleMessages()
    .then((earlier) => {
      earlier.forEach(record);
    })
    .catch(() => undefined);
}

/**
 * Every app a spec launches goes through here, so every window is watched. A violation is both a
 * `securitypolicyviolation` event and a console error. The first window may have loaded before
 * this returns: `consoleMessages()` recovers what it already logged, and the evaluate arms the
 * event listener on the document it already has. The init script covers each document after that.
 */
async function launch(options) {
  const app = await _electron.launch(options);
  await app.context().addInitScript(REPORT_VIOLATIONS_FROM_PAGE);
  app.windows().forEach(watchWindow);
  app.on('window', watchWindow);
  return app;
}

function takeViolations() {
  return unreported.splice(0);
}

export const electron = { launch };

export const test = base.extend({
  /** Violations a spec expects to provoke take them out here; whatever is left fails the test. */
  csp: [
    async ({}, use) => {
      await use({ takeViolations });
      expect(takeViolations(), 'a window broke its Content-Security-Policy').toEqual([]);
    },
    { auto: true },
  ],
  cspAtWorkerEnd: [
    async ({}, use) => {
      await use();
      expect(takeViolations(), 'a Content-Security-Policy violation after the last test').toEqual([]);
    },
    { scope: 'worker', auto: true },
  ],
});

export { expect };

import { test, expect, electron } from './smoke-test.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { shellControl } from './shell-control.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.join(__dirname, '..', '..');
const ACCOUNT_FULL_FIXTURE = path.join(__dirname, '..', 'fixtures', 'account-full.json');

const FOREIGN = 'https://csp-probe.invalid';

const electronExecutable = () =>
  path.join(desktopRoot, 'node_modules', 'electron', 'dist', process.platform === 'win32' ? 'electron.exe' : 'electron');

/**
 * Each probe tries one thing the policy exists to stop and reports whether it took effect, so a
 * regression names the directive that stopped holding. The foreign host is a reserved `.invalid`
 * name: if a probe were ever allowed, it still could not reach a real server.
 */
const PROBES = [
  {
    name: 'an inline script element',
    directive: 'script-src-elem',
    run: () => {
      const script = document.createElement('script');
      script.textContent = 'window.__probe.ran = true';
      document.body.append(script);
      script.remove();
    },
  },
  {
    name: 'eval',
    directive: 'script-src',
    run: () =>
      new Promise((resolve) => {
        setTimeout(() => {
          try {
            (0, eval)('window.__probe.ran = true');
          } catch {
            resolve();
          }
          resolve();
        }, 0);
      }),
  },
  {
    name: 'new Function',
    directive: 'script-src',
    run: () =>
      new Promise((resolve) => {
        setTimeout(() => {
          try {
            new Function('window.__probe.ran = true')();
          } catch {
            resolve();
          }
          resolve();
        }, 0);
      }),
  },
  {
    name: 'a string handed to setTimeout',
    directive: 'script-src',
    run: () => {
      setTimeout('window.__probe.ran = true', 0);
    },
  },
  {
    name: 'a javascript: link',
    directive: 'script-src-elem',
    run: () => {
      const link = document.createElement('a');
      link.href = 'javascript:window.__probe.ran = true';
      document.body.append(link);
      link.click();
      link.remove();
    },
  },
  {
    name: 'an inline event handler attribute',
    directive: 'script-src-attr',
    run: () => {
      const button = document.createElement('button');
      button.setAttribute('onclick', 'window.__probe.ran = true');
      document.body.append(button);
      button.click();
      button.remove();
    },
  },
  {
    name: 'a data: script',
    directive: 'script-src-elem',
    run: () => {
      const script = document.createElement('script');
      script.src = 'data:text/javascript,window.__probe.ran = true';
      document.body.append(script);
    },
  },
  {
    name: 'a blob: script',
    directive: 'script-src-elem',
    run: () => {
      const script = document.createElement('script');
      script.src = URL.createObjectURL(new Blob(['window.__probe.ran = true'], { type: 'text/javascript' }));
      document.body.append(script);
    },
  },
  {
    name: 'a script from a foreign origin',
    directive: 'script-src-elem',
    run: (foreign) => {
      const script = document.createElement('script');
      script.src = `${foreign}/a.js`;
      document.body.append(script);
    },
  },
  {
    name: 'a dynamic import from a foreign origin',
    directive: 'script-src-elem',
    run: async (foreign) => {
      await import(`${foreign}/a.js`).catch(() => undefined);
    },
  },
  {
    name: 'a style attribute set through setAttribute',
    directive: 'style-src-attr',
    run: () => {
      const element = document.createElement('div');
      element.setAttribute('style', 'color: rgb(1, 2, 3)');
      document.body.append(element);
      window.__probe.ran = getComputedStyle(element).color === 'rgb(1, 2, 3)';
      element.remove();
    },
  },
  {
    name: 'a stylesheet from a foreign origin',
    directive: 'style-src-elem',
    run: (foreign) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = `${foreign}/a.css`;
      document.head.append(link);
    },
  },
  {
    name: 'an inline style element',
    directive: 'style-src-elem',
    run: () => {
      const style = document.createElement('style');
      style.textContent = 'body { outline: 7px solid rgb(9, 8, 7) }';
      document.head.append(style);
      window.__probe.ran = getComputedStyle(document.body).outlineWidth === '7px';
      style.remove();
    },
  },
  {
    name: 'an image from a foreign origin',
    directive: 'img-src',
    run: (foreign) => {
      new Image().src = `${foreign}/a.png`;
    },
  },
  {
    name: 'a font from a foreign origin',
    directive: 'font-src',
    run: async (foreign) => {
      await new FontFace('probe', `url(${foreign}/a.woff2)`).load().catch(() => undefined);
    },
  },
  {
    name: 'fetch to a foreign origin',
    directive: 'connect-src',
    run: async (foreign) => {
      await fetch(`${foreign}/`).catch(() => undefined);
    },
  },
  {
    name: 'fetch of a data: URL',
    directive: 'connect-src',
    run: async () => {
      await fetch('data:text/plain,probe').catch(() => undefined);
    },
  },
  {
    name: 'XMLHttpRequest to a foreign origin',
    directive: 'connect-src',
    run: (foreign) => {
      const request = new XMLHttpRequest();
      request.open('GET', `${foreign}/`);
      try {
        request.send();
      } catch {
        return;
      }
    },
  },
  {
    name: 'a WebSocket to a foreign origin',
    directive: 'connect-src',
    run: (foreign) => {
      try {
        new WebSocket(foreign.replace('https', 'wss'));
      } catch {
        return;
      }
    },
  },
  {
    name: 'a beacon to a foreign origin',
    directive: 'connect-src',
    run: (foreign) => {
      navigator.sendBeacon(`${foreign}/`, 'probe');
    },
  },
  {
    name: 'a frame',
    directive: 'frame-src',
    run: (foreign) => {
      const frame = document.createElement('iframe');
      frame.src = `${foreign}/`;
      document.body.append(frame);
    },
  },
  {
    name: 'an object element',
    directive: 'object-src',
    run: (foreign) => {
      const object = document.createElement('object');
      object.data = `${foreign}/a.swf`;
      document.body.append(object);
    },
  },
  {
    name: 'a blob: worker',
    directive: 'worker-src',
    run: () => {
      try {
        new Worker(URL.createObjectURL(new Blob(['self.postMessage(1)'], { type: 'text/javascript' })));
      } catch {
        return;
      }
    },
  },
  {
    name: 'a form submitted to a foreign origin',
    directive: 'form-action',
    run: (foreign) => {
      const form = document.createElement('form');
      form.action = `${foreign}/`;
      form.method = 'post';
      document.body.append(form);
      form.submit();
    },
  },
  {
    name: 'a base element',
    directive: 'base-uri',
    run: (foreign) => {
      const base = document.createElement('base');
      base.href = `${foreign}/`;
      document.head.append(base);
    },
  },
];

async function launchLiveApp(userDataDir) {
  const app = await electron.launch({
    executablePath: electronExecutable(),
    args: [desktopRoot],
    env: {
      ...process.env,
      NODE_ENV: 'production',
      BFC_FLAVOR: 'dev',
      BFC_GAME_READER: 'fixture',
      BFC_FIXTURE_ACCOUNT_FILE: ACCOUNT_FULL_FIXTURE,
      BFC_LIVE_SOURCE: 'replay',
      BFC_USER_DATA_DIR: userDataDir,
      BFC_TOKEN_PATH_OVERRIDE: path.join(desktopRoot, 'tests', 'smoke', '.no-such-session.cfg'),
      ELECTRON_ENABLE_LOGGING: '1',
    },
  });

  const page = await app.firstWindow();
  await page.waitForSelector('[data-testid="app-ready"]', { timeout: 60_000 });
  await expect(page.getByTestId('consent-modal')).toBeVisible({ timeout: 30_000 });
  await page.getByTestId('consent-accept').click();
  await expect(page.getByTestId('consent-modal')).toBeHidden({ timeout: 30_000 });
  await page.waitForSelector('[data-testid="live-hero-list"]', { timeout: 60_000 });
  return { app, page };
}

/** Runs every probe in the window and reports, per probe, whether it took effect and which
 *  directives the browser blamed for blocking it. */
async function runProbes(window) {
  await window.evaluate(() => {
    window.__blamed = [];
    document.addEventListener('securitypolicyviolation', (event) => window.__blamed.push(event.effectiveDirective));
  });

  const results = [];
  for (const probe of PROBES) {
    await window.evaluate(() => {
      window.__probe = { ran: false };
      window.__blamed.length = 0;
    });
    const thrown = await window.evaluate(probe.run, FOREIGN).then(
      () => null,
      (error) => error.message,
    );
    const read = () => window.evaluate(() => ({ ran: window.__probe.ran, blamed: [...window.__blamed] }));
    await expect.poll(async () => (await read()).blamed, { timeout: 5_000, message: probe.name }).toContain(probe.directive);
    const { ran, blamed } = await read();
    results.push({ name: probe.name, ran, blamed, thrown });
  }
  return results;
}

test.describe.serial('renderer Content-Security-Policy', () => {
  let userDataDir;
  let app;
  let main;
  let mini;

  test.beforeAll(async () => {
    userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bfc-csp-'));
    ({ app, page: main } = await launchLiveApp(userDataDir));
    const miniOpened = app.waitForEvent('window', { timeout: 30_000 });
    await (await shellControl(main, 'open-mini')).click();
    mini = await miniOpened;
    await expect(mini.getByTestId('mini-live-page')).toBeVisible({ timeout: 30_000 });
  });

  test.afterAll(async () => {
    await app?.close().catch(() => undefined);
    fs.rmSync(userDataDir, { recursive: true, force: true });
  });

  for (const [label, windowOf] of [
    ['main window', () => main],
    ['mini-live window', () => mini],
  ]) {
    test(`the ${label} serves its document with a strict policy`, async () => {
      const served = await windowOf().evaluate(async () => {
        const document_ = await fetch(location.href);
        const script = [...document.scripts].find((element) => element.src);
        const chunk = await fetch(script.src);
        return {
          documentPolicy: document_.headers.get('content-security-policy'),
          chunkPolicy: chunk.headers.get('content-security-policy'),
          chunkSniffing: chunk.headers.get('x-content-type-options'),
        };
      });
      expect(served.documentPolicy).toContain("default-src 'none'");
      expect(served.documentPolicy).toMatch(/script-src 'self' 'sha256-[^']+'/);
      expect(served.documentPolicy).not.toMatch(/unsafe-inline|unsafe-eval/);
      expect(served.chunkPolicy).toContain("script-src 'self'");
      expect(served.chunkSniffing).toBe('nosniff');
    });

    test(`the ${label} blocks every probe and names the directive that stopped it`, async ({ csp }) => {
      const results = await runProbes(windowOf());
      for (const probe of PROBES) {
        const result = results.find((entry) => entry.name === probe.name);
        expect(result.ran, `${probe.name} took effect`).toBe(false);
        expect(result.blamed, `${probe.name} blamed`).toContain(probe.directive);
      }

      const seenByGuard = csp.takeViolations();
      expect(seenByGuard.some((entry) => entry.includes('Refused to')), 'the console channel of the suite guard').toBe(true);
      expect(seenByGuard.some((entry) => entry.includes('__bfc_csp_violation__')), 'the event channel of the suite guard').toBe(true);
    });

    test(`the ${label} applies the inline styles its markup was prerendered with`, async () => {
      const prerendered = await windowOf().evaluate(() =>
        [...document.querySelectorAll('[style*="-webkit-app-region"]')].map((element) => ({
          declared: element.getAttribute('style').match(/-webkit-app-region:\s*(drag|no-drag)/)[1],
          applied: getComputedStyle(element).getPropertyValue('-webkit-app-region'),
        })),
      );
      expect(prerendered.length).toBeGreaterThan(0);
      for (const { declared, applied } of prerendered) expect(applied).toBe(declared);
    });

    test(`the ${label} still lets the page set styles through the CSSOM`, async () => {
      const colour = await windowOf().evaluate(() => {
        const element = document.createElement('div');
        document.body.append(element);
        element.style.color = 'rgb(4, 5, 6)';
        const computed = getComputedStyle(element).color;
        element.remove();
        return computed;
      });
      expect(colour).toBe('rgb(4, 5, 6)');
    });
  }

  test('a page cannot run the inline script of another page', async ({ csp }) => {
    const inlineScripts = (window) =>
      window.evaluate(() => [...document.scripts].filter((script) => !script.src).map((script) => script.textContent));
    const [mainScripts, miniScripts] = [await inlineScripts(main), await inlineScripts(mini)];
    const onlyOnMini = miniScripts.find((text) => !mainScripts.includes(text));
    expect(onlyOnMini, 'the mini page carries an inline script the main page does not').toBeTruthy();

    const ran = await main.evaluate(async (text) => {
      window.__crossPage = false;
      const original = self.__next_f.push;
      self.__next_f.push = () => {
        window.__crossPage = true;
      };
      const script = document.createElement('script');
      script.textContent = text;
      document.body.append(script);
      script.remove();
      await new Promise((resolve) => setTimeout(resolve, 150));
      self.__next_f.push = original;
      return window.__crossPage;
    }, onlyOnMini);

    expect(ran).toBe(false);
    expect(csp.takeViolations().length).toBeGreaterThan(0);
  });
});

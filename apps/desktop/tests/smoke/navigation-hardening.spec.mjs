import { test, expect, electron } from './smoke-test.mjs';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { shellControl, closeShellOverflow } from './shell-control.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.join(__dirname, '..', '..');
const ACCOUNT_FULL_FIXTURE = path.join(__dirname, '..', 'fixtures', 'account-full.json');
const REFERRAL_SOURCE = path.join(desktopRoot, '..', '..', 'packages', 'domain', 'src', 'referral.ts');

/**
 * What stops a page from sending the player's browser somewhere, from loading a foreign frame, and
 * from asking Chromium for a capability. `shell.openExternal` is replaced by a recorder before
 * anything is probed, so no probe here can open a real browser; the foreign hosts are reserved
 * `.invalid` names for the same reason.
 *
 * Navigation events are watched from the main process by a second listener registered after the
 * app's own, so the spec can tell which layer refused a probe: the policy under test, or the CSP
 * before the navigation ever started.
 */
const FOREIGN = 'https://navigation-probe.invalid/landing';

function electronExecutable() {
  return path.join(
    desktopRoot,
    'node_modules',
    'electron',
    'dist',
    process.platform === 'win32' ? 'electron.exe' : 'electron',
  );
}

function referralCode() {
  const match = /REFERRAL_CODE\s*=\s*'([^']+)'/.exec(fs.readFileSync(REFERRAL_SOURCE, 'utf8'));
  if (!match) throw new Error(`could not read the referral code from ${REFERRAL_SOURCE}`);
  return match[1];
}

async function stubBrowser(app) {
  await app.evaluate(({ shell }) => {
    globalThis.__openedUrls = [];
    shell.openExternal = (url) => {
      globalThis.__openedUrls.push(String(url));
      return Promise.resolve();
    };
  });
}

const openedUrls = (app) => app.evaluate(() => globalThis.__openedUrls.slice());

/** Registers after the app's own listeners, so `defaultPrevented` is what the policy decided. */
async function watchNavigations(app) {
  await app.evaluate(({ BrowserWindow }) => {
    globalThis.__navigations ??= [];
    const watched = (globalThis.__watchedWindowIds ??= new Set());
    for (const win of BrowserWindow.getAllWindows()) {
      if (watched.has(win.id)) continue;
      watched.add(win.id);
      for (const kind of ['will-navigate', 'will-frame-navigate', 'will-redirect']) {
        win.webContents.on(kind, (details) => {
          globalThis.__navigations.push({
            kind,
            url: details.url,
            isMainFrame: details.isMainFrame,
            prevented: details.defaultPrevented,
          });
        });
      }
    }
  });
}

const navigations = (app) => app.evaluate(() => globalThis.__navigations.slice());

async function launch({ userDataDir, extraEnv = {} }) {
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
      ...extraEnv,
    },
  });
  await stubBrowser(app);
  return app;
}

async function acceptConsent(page) {
  await page.waitForSelector('[data-testid="app-ready"]', { timeout: 60_000 });
  await expect(page.getByTestId('consent-modal')).toBeVisible({ timeout: 30_000 });
  await page.getByTestId('consent-accept').click();
  await expect(page.getByTestId('consent-modal')).toBeHidden({ timeout: 30_000 });
  await page.waitForSelector('[data-testid="live-hero-list"]', { timeout: 60_000 });
}

async function openMini(app, page) {
  const opened = app.waitForEvent('window', { timeout: 30_000 });
  await (await shellControl(page, 'open-mini')).click();
  const mini = await opened;
  await expect(mini.getByTestId('mini-live-page')).toBeVisible({ timeout: 30_000 });
  await watchNavigations(app);
  return mini;
}

async function openSettings(page) {
  await page.getByTestId('shell-settings').click();
  await expect(page.getByTestId('settings-view')).toBeVisible({ timeout: 20_000 });
}

const META_REFRESH = (url) => {
  document.head.insertAdjacentHTML('beforeend', `<meta http-equiv="refresh" content="0;url=${url}">`);
};

const SCRIPTED_NAVIGATIONS = {
  'location.assign': (url) => {
    window.location.assign(url);
  },
  'a same-window link': (url) => {
    const link = document.createElement('a');
    link.href = url;
    document.body.append(link);
    link.click();
  },
};

const FORM_POST = (url) => {
  const form = document.createElement('form');
  form.method = 'post';
  form.action = url;
  document.body.append(form);
  form.submit();
};

async function expectRefused(app, page, expectedWindowUrl, trigger) {
  await expect
    .poll(async () => (await navigations(app)).some((entry) => entry.kind === 'will-navigate' && entry.url === FOREIGN), {
      timeout: 15_000,
      message: `${trigger}: the navigation reached the main process`,
    })
    .toBe(true);
  const attempts = (await navigations(app)).filter((entry) => entry.kind === 'will-navigate' && entry.url === FOREIGN);
  expect(attempts.length, `${trigger}: at least one top-level attempt`).toBeGreaterThan(0);
  expect(attempts.every((entry) => entry.prevented), `${trigger}: every attempt was prevented ${JSON.stringify(attempts)}`).toBe(true);
  expect(await openedUrls(app), `${trigger}: the browser was not opened`).toEqual([]);
  expect(page.url().startsWith(expectedWindowUrl), `${trigger}: the window stayed on the app`).toBe(true);
}

test.describe('navigation, frame and permission hardening', () => {
  test.describe.configure({ mode: 'serial' });

  let userDataDir;
  let app;
  let page;
  let mini;

  test.beforeAll(async () => {
    userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bfc-navigation-'));
    app = await launch({ userDataDir });
    page = await app.firstWindow();
    await acceptConsent(page);
    await watchNavigations(app);
    mini = await openMini(app, page);
  });

  test.afterAll(async () => {
    await app?.close().catch(() => undefined);
    if (userDataDir) fs.rmSync(userDataDir, { recursive: true, force: true });
  });

  test.beforeEach(async () => {
    await app.evaluate(() => {
      globalThis.__openedUrls.length = 0;
      globalThis.__navigations.length = 0;
    });
  });

  test('every external link the UI shows reaches the browser with exactly its own url', async () => {
    await openSettings(page);

    const links = [];
    for (const testId of ['settings-support-coffee', 'settings-usage-privacy-policy']) {
      const link = page.getByTestId(testId);
      await link.scrollIntoViewIfNeeded();
      const href = await link.getAttribute('href');
      expect(href, testId).toMatch(/^https:\/\//);
      await app.evaluate(() => {
        globalThis.__openedUrls.length = 0;
      });
      await link.click();
      await expect.poll(() => openedUrls(app), { message: `${testId} opened the browser` }).toEqual([href]);
      links.push(href);
    }
    expect(new Set(links).size).toBe(2);

    const topBar = await shellControl(page, 'shell-coffee');
    const topBarHref = await topBar.getAttribute('href');
    await app.evaluate(() => {
      globalThis.__openedUrls.length = 0;
    });
    await topBar.click();
    await expect.poll(() => openedUrls(app), { message: 'the top-bar link opened the browser' }).toEqual([topBarHref]);
    await closeShellOverflow(page);

    expect((await navigations(app)).filter((entry) => entry.kind === 'will-navigate')).toEqual([]);
  });

  test('a script cannot ask the browser for a capability, and the permission queries say so', async () => {
    const answers = await page.evaluate(async () => {
      const queried = {};
      for (const name of ['notifications', 'geolocation', 'camera', 'microphone', 'midi', 'clipboard-read', 'clipboard-write']) {
        try {
          queried[name] = (await navigator.permissions.query({ name })).state;
        } catch (error) {
          queried[name] = `unsupported:${error.name}`;
        }
      }
      const position = await new Promise((resolve) =>
        navigator.geolocation.getCurrentPosition(
          () => resolve('granted'),
          (error) => resolve(`error:${String(error.code)}`),
          { timeout: 5_000 },
        ),
      );
      return {
        queried,
        notification: await Notification.requestPermission(),
        position,
        media: await navigator.mediaDevices.getUserMedia({ audio: true, video: true }).then(
          () => 'granted',
          (error) => error.name,
        ),
      };
    });

    const { 'clipboard-write': clipboardWrite, ...refused } = answers.queried;
    expect(clipboardWrite, 'the one permission the app needs').toBe('granted');
    expect(refused).toEqual({
      notifications: 'denied',
      geolocation: 'denied',
      camera: 'denied',
      microphone: 'denied',
      midi: 'denied',
      'clipboard-read': 'denied',
    });
    expect(answers.notification).toBe('denied');
    expect(answers.position).toBe('error:1');
    expect(answers.media).toMatch(/NotAllowedError|NotFoundError/);
  });

  test('no device is ever offered to a script that asks for one after a click', async () => {
    await openSettings(page);
    const heading = page.locator('[data-testid="settings-view"] h2').first();
    for (const kind of ['hid', 'usb', 'serial', 'bluetooth']) {
      const outcome = page.evaluate(
        (name) =>
          new Promise((resolve) => {
            const requests = {
              hid: () => navigator.hid?.requestDevice({ filters: [] }),
              usb: () => navigator.usb?.requestDevice({ filters: [] }),
              serial: () => navigator.serial?.requestPort(),
              bluetooth: () => navigator.bluetooth?.requestDevice({ acceptAllDevices: true }),
            };
            document.addEventListener(
              'click',
              () => {
                Promise.resolve()
                  .then(() => requests[name]())
                  .then(
                    (value) => resolve(value === undefined ? 'unsupported' : Array.isArray(value) ? `devices:${String(value.length)}` : 'device'),
                    (error) => resolve(`rejected:${error.name}`),
                  );
              },
              { once: true },
            );
          }),
        kind,
      );
      await heading.click();
      const result = await outcome;
      expect(['unsupported', 'devices:0'].includes(result) || result.startsWith('rejected:'), `${kind}: ${result}`).toBe(true);
    }
  });

  test('copying the referral code still reaches the clipboard', async () => {
    await app.evaluate(({ clipboard }) => {
      clipboard.writeText('sentinel');
    });
    const control = await shellControl(page, 'shell-referral');
    await control.click();
    await expect
      .poll(() => app.evaluate(({ clipboard }) => clipboard.readText()), { message: 'the code reached the clipboard' })
      .toBe(referralCode());
    await closeShellOverflow(page);
  });

  // Playwright keeps waiting on a navigation the app refused, so every probe below runs after the
  // specs that click something.
  for (const [windowName, target] of [
    ['main', () => page],
    ['compact', () => mini],
  ]) {
    test(`a meta refresh to an https url does not open the browser or leave the app (${windowName} window)`, async () => {
      const window = target();
      await window.evaluate(META_REFRESH, FOREIGN);
      await expectRefused(app, window, 'app://bundle/', 'meta refresh');
    });

    for (const [name, run] of Object.entries(SCRIPTED_NAVIGATIONS)) {
      test(`${name} to an https url does not open the browser or leave the app (${windowName} window)`, async () => {
        const window = target();
        await window.evaluate(run, FOREIGN);
        await expectRefused(app, window, 'app://bundle/', name);
      });
    }
  }

  test('a foreign subframe never starts under the policy: the CSP refuses it before the main process sees a navigation', async ({ csp }) => {
    await page.evaluate(async (url) => {
      const frame = document.createElement('iframe');
      frame.id = 'foreign-frame';
      frame.src = url;
      document.body.append(frame);
      await new Promise((resolve) => {
        frame.addEventListener('load', resolve, { once: true });
        setTimeout(resolve, 3_000);
      });
    }, FOREIGN);

    // One refusal reaches the guard twice, as the browser's console line and as the page-side
    // event, a few milliseconds apart; both are claimed here, and nothing else.
    const claimed = [];
    const consoleLines = () =>
      claimed.filter((entry) => entry.includes('Refused to frame') && entry.includes("frame-src 'none'"));
    const events = () =>
      claimed.filter((entry) => entry.includes('__bfc_csp_violation__') && entry.includes('"directive":"frame-src"'));
    await expect
      .poll(
        () => {
          claimed.push(...csp.takeViolations());
          return [consoleLines().length > 0, events().length > 0];
        },
        { timeout: 10_000, message: 'the CSP refused the foreign frame, as a console line and as an event' },
      )
      .toEqual([true, true]);
    await page.waitForTimeout(500);
    claimed.push(...csp.takeViolations());
    expect([consoleLines().length, events().length, claimed.length], claimed.join('\n')).toEqual([1, 1, 2]);

    const frameAttempts = (await navigations(app)).filter((entry) => entry.kind === 'will-frame-navigate' && !entry.isMainFrame);
    expect(frameAttempts, 'the policy is the second layer; the dev-run spec below is the one that reaches it').toEqual([]);
    expect(page.frames().some((frame) => frame.url() === FOREIGN)).toBe(false);
    await page.evaluate(() => document.getElementById('foreign-frame')?.remove());
  });
});

const STATIC_MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function serveRendererOverLoopback(root) {
  const server = http.createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
    if (pathname === '/redirect-away') {
      response.writeHead(302, { location: FOREIGN }).end();
      return;
    }
    const target = path.join(root, pathname.endsWith('/') ? `${pathname}index.html` : pathname);
    if (path.relative(root, target).startsWith('..') || !fs.existsSync(target) || fs.statSync(target).isDirectory()) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, { 'content-type': STATIC_MIME_TYPES[path.extname(target)] ?? 'application/octet-stream' });
    fs.createReadStream(target).pipe(response);
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

test.describe('navigation hardening in a dev run, where no Content-Security-Policy is in the way', () => {
  test('with no CSP in the way, the policy alone refuses a foreign navigation, subframe and redirect, and still serves the dev origin', async () => {
    const devUserData = fs.mkdtempSync(path.join(os.tmpdir(), 'bfc-navigation-dev-'));
    const server = await serveRendererOverLoopback(path.join(desktopRoot, 'renderer', 'out'));
    const origin = `http://127.0.0.1:${String(server.address().port)}`;
    let devApp;

    try {
      devApp = await launch({
        userDataDir: devUserData,
        extraEnv: { NODE_ENV: 'development', BFC_RENDERER_URL: origin },
      });
      const devPage = await devApp.firstWindow();
      await devPage.waitForSelector('[data-testid="app-ready"]', { timeout: 60_000 });
      expect(devPage.url().startsWith(origin)).toBe(true);
      await watchNavigations(devApp);

      const policyHeader = await devPage.evaluate(async () => (await fetch(location.href)).headers.get('content-security-policy'));
      expect(policyHeader, 'no policy is delivered in this run, so only the main-process policy can refuse').toBeNull();

      await devPage.evaluate(META_REFRESH, FOREIGN);
      await expectRefused(devApp, devPage, origin, 'meta refresh');

      await devApp.evaluate(() => {
        globalThis.__navigations.length = 0;
      });
      await devPage.evaluate(FORM_POST, FOREIGN);
      await expectRefused(devApp, devPage, origin, 'form post');

      await devPage.evaluate(async (url) => {
        const frame = document.createElement('iframe');
        frame.id = 'foreign-frame';
        frame.src = url;
        document.body.append(frame);
        await new Promise((resolve) => {
          frame.addEventListener('load', resolve, { once: true });
          setTimeout(resolve, 3_000);
        });
      }, FOREIGN);
      await expect
        .poll(async () => (await navigations(devApp)).some((entry) => entry.kind === 'will-frame-navigate' && entry.url === FOREIGN), {
          timeout: 15_000,
          message: 'the foreign subframe navigation reached the main process',
        })
        .toBe(true);
      const attempts = (await navigations(devApp)).filter(
        (entry) => entry.kind === 'will-frame-navigate' && !entry.isMainFrame && entry.url === FOREIGN,
      );
      expect(attempts.length).toBeGreaterThan(0);
      expect(attempts.every((entry) => entry.prevented)).toBe(true);
      expect(devPage.frames().some((frame) => frame.url() === FOREIGN)).toBe(false);

      const sameOrigin = await devPage.evaluate(async () => {
        const frame = document.createElement('iframe');
        frame.srcdoc = '<p>child</p>';
        document.body.append(frame);
        await new Promise((resolve) => frame.addEventListener('load', resolve, { once: true }));
        const text = frame.contentDocument?.body.textContent;
        frame.remove();
        return text;
      });
      expect(sameOrigin, 'an empty-document child frame is not refused').toBe('child');

      await devApp.evaluate(() => {
        globalThis.__navigations.length = 0;
      });
      await devPage.evaluate((target) => {
        window.location.assign(target);
      }, `${origin}/redirect-away`);
      await expect
        .poll(async () => (await navigations(devApp)).some((entry) => entry.kind === 'will-redirect' && entry.url === FOREIGN), {
          timeout: 15_000,
          message: 'the server redirect reached the main process',
        })
        .toBe(true);
      const redirects = (await navigations(devApp)).filter((entry) => entry.kind === 'will-redirect' && entry.url === FOREIGN);
      expect(redirects.every((entry) => entry.prevented)).toBe(true);
      expect(await openedUrls(devApp)).toEqual([]);
      expect(devPage.url().startsWith(origin)).toBe(true);
    } finally {
      await devApp?.close().catch(() => undefined);
      await new Promise((resolve) => server.close(resolve));
      fs.rmSync(devUserData, { recursive: true, force: true });
    }
  });
});

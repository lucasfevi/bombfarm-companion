import { test, expect, electron } from './smoke-test.mjs';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { shellControl } from './shell-control.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.join(__dirname, '..', '..');
const ACCOUNT_FULL_FIXTURE = path.join(__dirname, '..', 'fixtures', 'account-full.json');
const PRELOAD_PATH = path.join(desktopRoot, 'dist', 'preload', 'index.cjs');
const REFUSAL = /IPC sender not permitted/;

function electronExecutable() {
  return path.join(
    desktopRoot,
    'node_modules',
    'electron',
    'dist',
    process.platform === 'win32' ? 'electron.exe' : 'electron',
  );
}

function probe(target, channel) {
  return target.evaluate(
    (name) =>
      window.bfc.invoke(name).then(
        (value) => ({ settled: 'resolved', value }),
        (error) => ({ settled: 'rejected', message: String(error && error.message) }),
      ),
    channel,
  );
}

function windowCount(app) {
  return app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length);
}

function probeFromUnknownWindow(app, { url, channel }) {
  return app.evaluate(
    async ({ BrowserWindow }, input) => {
      const stranger = new BrowserWindow({
        show: false,
        webPreferences: {
          preload: input.preload,
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: false,
        },
      });
      try {
        await stranger.loadURL(input.url);
        return await stranger.webContents.executeJavaScript(
          `window.bfc.invoke(${JSON.stringify(input.channel)}).then(
            (value) => ({ settled: 'resolved', value }),
            (error) => ({ settled: 'rejected', message: String(error && error.message) }),
          )`,
        );
      } finally {
        stranger.destroy();
      }
    },
    { url, channel, preload: PRELOAD_PATH },
  );
}

function probeAfterNavigatingAway(app, { windowUrlFragment, channel }) {
  return app.evaluate(
    async ({ BrowserWindow }, input) => {
      const known = BrowserWindow.getAllWindows().find((win) =>
        win.webContents.getURL().includes(input.windowUrlFragment),
      );
      if (!known) throw new Error(`no window at ${input.windowUrlFragment}`);
      await known.webContents.loadURL('data:text/html,<title>navigated away</title>');
      return await known.webContents.executeJavaScript(
        `window.bfc.invoke(${JSON.stringify(input.channel)}).then(
          (value) => ({ settled: 'resolved', value }),
          (error) => ({ settled: 'rejected', message: String(error && error.message) }),
        )`,
      );
    },
    { windowUrlFragment, channel },
  );
}

test.describe('IPC sender validation smoke', () => {
  test.describe.configure({ mode: 'serial' });

  let userDataDir;
  let app;
  let page;
  let mini;

  test.beforeAll(async () => {
    expect(fs.existsSync(PRELOAD_PATH), 'preload bundle is built').toBe(true);
    userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bfc-ipc-sender-'));
    app = await electron.launch({
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
        // SAFETY, reproduced from the other Live smokes: points the session-token read away from the
        // real %APPDATA% session file, so nothing here can issue a live authenticated request.
        BFC_TOKEN_PATH_OVERRIDE: path.join(desktopRoot, 'tests', 'smoke', '.no-such-session.cfg'),
        ELECTRON_ENABLE_LOGGING: '1',
      },
    });
    page = await app.firstWindow();
    await page.waitForSelector('[data-testid="app-ready"]', { timeout: 60_000 });
    await expect(page.getByTestId('consent-modal')).toBeVisible({ timeout: 30_000 });
    await page.getByTestId('consent-accept').click();
    await expect(page.getByTestId('consent-modal')).toBeHidden({ timeout: 30_000 });
    await page.waitForSelector('[data-testid="live-hero-list"]', { timeout: 60_000 });

    const miniOpened = app.waitForEvent('window', { timeout: 30_000 });
    await (await shellControl(page, 'open-mini')).click();
    mini = await miniOpened;
    await expect(mini.getByTestId('mini-live-page')).toBeVisible({ timeout: 30_000 });
  });

  test.afterAll(async () => {
    await app?.close().catch(() => undefined);
    if (userDataDir) fs.rmSync(userDataDir, { recursive: true, force: true });
  });

  test('the main window keeps every channel', async () => {
    expect(await probe(page, 'app:getFlavor')).toEqual({ settled: 'resolved', value: 'dev' });
  });

  test('the compact Live window gets its own channels and is refused the rest', async () => {
    expect((await probe(mini, 'settings:get')).settled).toBe('resolved');
    expect((await probe(mini, 'miniLive:getLayout')).settled).toBe('resolved');

    const refused = await probe(mini, 'app:getFlavor');
    expect(refused.settled).toBe('rejected');
    expect(refused.message).toMatch(REFUSAL);

    const windowControl = await probe(mini, 'window:minimize');
    expect(windowControl.settled).toBe('rejected');
    expect(windowControl.message).toMatch(REFUSAL);
  });

  test('a window the app does not own is refused with the same preload, at a foreign origin or at the app origin, for a channel the compact window may call and for one only the main window may', async () => {
    const urls = ['data:text/html,<title>stranger</title>', 'about:blank', 'app://bundle/mini-live/index.html'];
    for (const url of urls) {
      for (const channel of ['app:getFlavor', 'settings:get', 'miniLive:getLayout']) {
        const result = await probeFromUnknownWindow(app, { url, channel });
        expect(result.settled, `${url} ${channel}`).toBe('rejected');
        expect(result.message, `${url} ${channel}`).toMatch(REFUSAL);
      }
    }
    await expect.poll(() => windowCount(app), { timeout: 15_000 }).toBe(2);
  });

  test('the app scheme serves the bundle host only, so a look-alike host loads nothing', async () => {
    const statuses = await app.evaluate(async ({ net }) => {
      const statusOf = async (url) => (await net.fetch(url)).status;
      return {
        bundle: await statusOf('app://bundle/index.html'),
        otherHost: await statusOf('app://other-host/index.html'),
        lookAlike: await statusOf('app://bundle.evil/index.html'),
      };
    });
    expect(statuses).toEqual({ bundle: 200, otherHost: 404, lookAlike: 404 });
  });

  test('a child frame has no bridge of its own, and a foreign one is refused by the CSP before it could reach the top frame', async ({ csp }) => {
    const sameOrigin = await page.evaluate(async () => {
      const frame = document.createElement('iframe');
      frame.srcdoc = '<p>child</p>';
      document.body.append(frame);
      await new Promise((resolve) => frame.addEventListener('load', resolve, { once: true }));
      const result = { ownBridge: typeof frame.contentWindow.bfc };
      frame.remove();
      return result;
    });
    expect(sameOrigin.ownBridge).toBe('undefined');

    // The window's CSP (`frame-src 'none'`) now stops a foreign child frame before the question of
    // what it could reach arises, so the layer under test here is the policy, not the sender check.
    await page.evaluate(async () => {
      const frame = document.createElement('iframe');
      frame.id = 'foreign-frame';
      frame.src = 'data:text/html,<p>foreign</p>';
      document.body.append(frame);
      await new Promise((resolve) => {
        frame.addEventListener('load', resolve, { once: true });
        setTimeout(resolve, 3_000);
      });
    });

    const claimed = [];
    await expect
      .poll(
        () => {
          claimed.push(...csp.takeViolations());
          return claimed.some((entry) => entry.includes("frame-src 'none'"));
        },
        { timeout: 10_000, message: 'the CSP refused the foreign frame' },
      )
      .toBe(true);
    expect(claimed.every((entry) => /frame-src|text\/html,<p>foreign/.test(entry)), claimed.join('\n')).toBe(true);
    expect(page.frames().some((frame) => frame.url().startsWith('data:')), 'no foreign frame attached').toBe(false);
    await page.evaluate(() => document.getElementById('foreign-frame')?.remove());
  });

  test('a same-origin child frame that borrows the top frame bridge is the top frame to the main process', async () => {
    const borrowed = await page.evaluate(async () => {
      const frame = document.createElement('iframe');
      frame.srcdoc = '<p>child</p>';
      document.body.append(frame);
      await new Promise((resolve) => frame.addEventListener('load', resolve, { once: true }));
      try {
        return await frame.contentWindow.top.bfc.invoke('app:getFlavor');
      } finally {
        frame.remove();
      }
    });
    expect(borrowed).toBe('dev');
  });

  test('window.open never produces a window that could carry the bridge', async () => {
    const before = await windowCount(app);
    const results = await page.evaluate(() => [
      window.open('about:blank') === null,
      window.open('app://bundle/mini-live/index.html') === null,
      window.open('data:text/html,<p>popup</p>') === null,
    ]);
    expect(results).toEqual([true, true, true]);
    expect(await windowCount(app)).toBe(before);
  });

  test('a known window navigated off the app origin is refused, even for a channel it is allowed', async () => {
    const windows = await windowCount(app);

    const miniResult = await probeAfterNavigatingAway(app, {
      windowUrlFragment: '/mini-live/',
      channel: 'miniLive:close',
    });
    expect(miniResult.settled).toBe('rejected');
    expect(miniResult.message).toMatch(REFUSAL);
    expect(await windowCount(app)).toBe(windows);

    const mainResult = await probeAfterNavigatingAway(app, {
      windowUrlFragment: 'app://bundle/index.html',
      channel: 'settings:get',
    });
    expect(mainResult.settled).toBe('rejected');
    expect(mainResult.message).toMatch(REFUSAL);
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

test.describe('IPC sender validation in a dev run', () => {
  test('the dev renderer origin is served, and still only to a window the app owns', async () => {
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bfc-ipc-sender-dev-'));
    const server = await serveRendererOverLoopback(path.join(desktopRoot, 'renderer', 'out'));
    const origin = `http://127.0.0.1:${String(server.address().port)}`;
    let devApp;

    try {
      devApp = await electron.launch({
        executablePath: electronExecutable(),
        args: [desktopRoot],
        env: {
          ...process.env,
          NODE_ENV: 'development',
          BFC_RENDERER_URL: origin,
          BFC_FLAVOR: 'dev',
          BFC_GAME_READER: 'fixture',
          BFC_USER_DATA_DIR: userDataDir,
          ELECTRON_ENABLE_LOGGING: '1',
        },
      });
      const devPage = await devApp.firstWindow();
      await devPage.waitForSelector('[data-testid="app-ready"]', { timeout: 60_000 });
      expect(devPage.url().startsWith(origin)).toBe(true);

      expect(await probe(devPage, 'app:getFlavor')).toEqual({ settled: 'resolved', value: 'dev' });

      const stranger = await probeFromUnknownWindow(devApp, { url: `${origin}/mini-live/`, channel: 'app:getFlavor' });
      expect(stranger.settled).toBe('rejected');
      expect(stranger.message).toMatch(REFUSAL);
    } finally {
      await devApp?.close().catch(() => undefined);
      await new Promise((resolve) => server.close(resolve));
      fs.rmSync(userDataDir, { recursive: true, force: true });
    }
  });
});

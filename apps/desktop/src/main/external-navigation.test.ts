import { describe, expect, it, vi } from 'vitest';
import type { WebContents } from 'electron';
import {
  applyExternalNavigationPolicy,
  decideFrameNavigation,
  decideNavigation,
  decideTopLevelNavigation,
} from './external-navigation.js';
import type { LogPort } from './storage/index.js';

const STEAM_LISTING =
  'https://steamcommunity.com/market/listings/3527290/Bomb%20Farm%20Crate';
const RENDERER_ENTRY = 'app://bundle/index.html';
const DEV_RENDERER = 'http://127.0.0.1:3000';

describe('decideNavigation', () => {
  it('opens an https Steam market listing in the default browser', () => {
    expect(decideNavigation(STEAM_LISTING)).toBe('open-external');
  });

  it('keeps the renderer bundle scheme inside the app', () => {
    expect(decideNavigation(RENDERER_ENTRY)).toBe('allow-internal');
  });

  it.each([
    'app://other-host/index.html',
    'app://bundle.evil/index.html',
    'app://bundle@evil/index.html',
    'app://bundle:8080/index.html',
    'app:///index.html',
  ])('does not treat the look-alike app url %s as internal', (url) => {
    expect(decideNavigation(url)).toBe('block');
  });

  it('keeps devtools inside the app', () => {
    expect(decideNavigation('devtools://devtools/bundled/devtools_app.html')).toBe('allow-internal');
  });

  it('keeps the dev renderer origin inside the app when it is declared internal', () => {
    expect(decideNavigation(`${DEV_RENDERER}/live`, [DEV_RENDERER])).toBe('allow-internal');
  });

  it('blocks an http origin that was not declared internal', () => {
    expect(decideNavigation('http://example.com/', [DEV_RENDERER])).toBe('block');
  });

  it('blocks javascript:', () => {
    expect(decideNavigation('javascript:alert(document.cookie)')).toBe('block');
  });

  it('blocks data:', () => {
    expect(decideNavigation('data:text/html,<script>fetch("http://evil")</script>')).toBe('block');
  });

  it('blocks file:', () => {
    expect(decideNavigation('file:///C:/Windows/System32/calc.exe')).toBe('block');
  });

  it('blocks an unknown scheme', () => {
    expect(decideNavigation('some-updater://install')).toBe('block');
  });

  it('does not match one opaque origin against another', () => {
    expect(decideNavigation('file:///C:/secrets.txt', ['data:text/plain,x'])).toBe('block');
  });

  it('blocks a malformed url instead of throwing', () => {
    expect(decideNavigation('not a url at all')).toBe('block');
    expect(decideNavigation('')).toBe('block');
    expect(decideNavigation('https://')).toBe('block');
  });
});

describe('decideTopLevelNavigation', () => {
  it.each([RENDERER_ENTRY, 'app://bundle/live', 'app://bundle/mini-live/index.html?x=1#y'])(
    'allows the app origin: %s',
    (url) => {
      expect(decideTopLevelNavigation(url)).toBe('allow');
    },
  );

  it.each([
    STEAM_LISTING,
    'http://example.com/',
    'app://bundle.evil/',
    'app://bundle@evil/',
    'app://bundle:8080/',
    'app:///index.html',
    'devtools://devtools/bundled/devtools_app.html',
    'about:blank',
    'javascript:alert(1)',
    'data:text/html,x',
    'file:///C:/x',
    'not a url',
    '',
  ])('refuses %s', (url) => {
    expect(decideTopLevelNavigation(url, [DEV_RENDERER])).toBe('block');
  });

  it('does not match one opaque origin against another', () => {
    expect(decideTopLevelNavigation('file:///C:/secrets.txt', ['data:text/plain,x'])).toBe('block');
    expect(decideFrameNavigation('file:///C:/secrets.txt', ['data:text/plain,x'])).toBe('block');
  });

  it('allows the dev renderer origin only when it is declared', () => {
    expect(decideTopLevelNavigation(`${DEV_RENDERER}/live`)).toBe('block');
    expect(decideTopLevelNavigation(`${DEV_RENDERER}/live`, [DEV_RENDERER])).toBe('allow');
    expect(decideTopLevelNavigation('http://127.0.0.1:3001/', [DEV_RENDERER])).toBe('block');
    expect(decideTopLevelNavigation('https://127.0.0.1:3000/', [DEV_RENDERER])).toBe('block');
  });
});

describe('decideFrameNavigation', () => {
  it.each([RENDERER_ENTRY, 'about:blank', 'about:srcdoc', 'about:blank#x'])('allows %s', (url) => {
    expect(decideFrameNavigation(url)).toBe('allow');
  });

  it.each([
    STEAM_LISTING,
    'http://127.0.0.1:3000/',
    'data:text/html,x',
    'blob:app://bundle/1',
    'javascript:alert(1)',
    'about:other',
    'file:///C:/x',
    'app://bundle.evil/',
    '',
  ])('refuses %s', (url) => {
    expect(decideFrameNavigation(url)).toBe('block');
  });

  it('allows the dev renderer origin only when it is declared', () => {
    expect(decideFrameNavigation(`${DEV_RENDERER}/`, [DEV_RENDERER])).toBe('allow');
  });
});

interface NavigateDetails {
  url: string;
  isMainFrame: boolean;
  isSameDocument?: boolean;
  initiator?: unknown;
  preventDefault(): void;
}

function createWebContentsSpy(): {
  contents: WebContents;
  openWindow(url: string): { action: string };
  navigate(url: string): { prevented: boolean };
  navigateFrame(url: string, options?: { isMainFrame?: boolean }): { prevented: boolean };
  redirect(url: string, options: { isMainFrame: boolean }): { prevented: boolean };
  startNavigation(
    url: string,
    options?: { isMainFrame?: boolean; isSameDocument?: boolean; initiated?: boolean },
  ): Promise<void>;
  commit(url: string): Promise<void>;
  loadURL: ReturnType<typeof vi.fn<(url: string) => Promise<void>>>;
} {
  const loadURL = vi.fn<(url: string) => Promise<void>>().mockResolvedValue(undefined);
  let openHandler: ((details: { url: string }) => { action: string }) | null = null;
  const listeners = new Map<string, (details: NavigateDetails) => void>();

  const contents = {
    loadURL,
    isDestroyed: () => false,
    setWindowOpenHandler(handler: (details: { url: string }) => { action: string }) {
      openHandler = handler;
    },
    on(event: string, listener: (details: NavigateDetails) => void) {
      listeners.set(event, listener);
      return contents;
    },
  };

  const emit = (event: string, url: string, isMainFrame: boolean): { prevented: boolean } => {
    const listener = listeners.get(event);
    if (!listener) {
      throw new Error(`no ${event} listener registered`);
    }
    let prevented = false;
    listener({
      url,
      isMainFrame,
      preventDefault: () => {
        prevented = true;
      },
    });
    return { prevented };
  };

  return {
    contents: contents as unknown as WebContents,
    openWindow(url) {
      if (!openHandler) {
        throw new Error('no window-open handler registered');
      }
      return openHandler({ url });
    },
    navigate: (url) => emit('will-navigate', url, true),
    navigateFrame: (url, options) => emit('will-frame-navigate', url, options?.isMainFrame ?? false),
    redirect: (url, options) => emit('will-redirect', url, options.isMainFrame),
    loadURL,
    async commit(url) {
      const listener = listeners.get('did-navigate') as unknown as ((event: object, url: string) => void) | undefined;
      if (!listener) {
        throw new Error('no did-navigate listener registered');
      }
      listener({}, url);
      await new Promise((resolve) => setImmediate(resolve));
    },
    async startNavigation(url, options) {
      const listener = listeners.get('did-start-navigation');
      if (!listener) {
        throw new Error('no did-start-navigation listener registered');
      }
      listener({
        url,
        isMainFrame: options?.isMainFrame ?? true,
        isSameDocument: options?.isSameDocument ?? false,
        initiator: options?.initiated === false ? null : {},
        preventDefault: () => undefined,
      });
      await new Promise((resolve) => setImmediate(resolve));
    },
  };
}

function createLogSpy(): LogPort & { records: Record<string, unknown>[] } {
  const records: Record<string, unknown>[] = [];
  return {
    records,
    info: (record) => records.push(record),
    warn: (record) => records.push(record),
    error: (record) => records.push(record),
  };
}

function applyPolicy(
  contents: WebContents,
  deps: Omit<Parameters<typeof applyExternalNavigationPolicy>[1], 'entryUrl'> & { entryUrl?: string },
): void {
  applyExternalNavigationPolicy(contents, { entryUrl: RENDERER_ENTRY, ...deps });
}

describe('applyExternalNavigationPolicy', () => {
  it('hands a target=_blank https link to the browser and creates no in-app window', () => {
    const openExternal = vi.fn<(url: string) => Promise<void>>().mockResolvedValue(undefined);
    const spy = createWebContentsSpy();
    applyPolicy(spy.contents, { openExternal, log: createLogSpy() });

    expect(spy.openWindow(STEAM_LISTING)).toEqual({ action: 'deny' });
    expect(openExternal).toHaveBeenCalledWith(STEAM_LISTING);
  });

  it('never hands a non-https window-open url to the browser', () => {
    const openExternal = vi.fn<(url: string) => Promise<void>>().mockResolvedValue(undefined);
    const log = createLogSpy();
    const spy = createWebContentsSpy();
    applyPolicy(spy.contents, { openExternal, log });

    expect(spy.openWindow('javascript:alert(1)')).toEqual({ action: 'deny' });
    expect(openExternal).not.toHaveBeenCalled();
    expect(log.records).toContainEqual(
      expect.objectContaining({ event: 'navigation.blocked', url: 'javascript:alert(1)' }),
    );
  });

  it('refuses an https navigation away from the app and never hands it to the browser', () => {
    const openExternal = vi.fn<(url: string) => Promise<void>>().mockResolvedValue(undefined);
    const log = createLogSpy();
    const spy = createWebContentsSpy();
    applyPolicy(spy.contents, { openExternal, log });

    expect(spy.navigate(STEAM_LISTING)).toEqual({ prevented: true });
    expect(openExternal).not.toHaveBeenCalled();
    expect(log.records).toContainEqual(
      expect.objectContaining({ event: 'navigation.blocked', trigger: 'will-navigate', url: STEAM_LISTING }),
    );
  });

  it.each(['http://example.com/', 'javascript:alert(1)', 'data:text/html,x', 'file:///C:/x', 'app://bundle.evil/'])(
    'refuses a navigation to %s without opening anything',
    (url) => {
      const openExternal = vi.fn<(url: string) => Promise<void>>().mockResolvedValue(undefined);
      const spy = createWebContentsSpy();
      applyPolicy(spy.contents, { openExternal, log: createLogSpy() });

      expect(spy.navigate(url)).toEqual({ prevented: true });
      expect(openExternal).not.toHaveBeenCalled();
    },
  );

  it('lets the renderer navigate within its own bundle', () => {
    const openExternal = vi.fn<(url: string) => Promise<void>>().mockResolvedValue(undefined);
    const spy = createWebContentsSpy();
    applyPolicy(spy.contents, { openExternal, log: createLogSpy() });

    expect(spy.navigate('app://bundle/live')).toEqual({ prevented: false });
    expect(openExternal).not.toHaveBeenCalled();
  });

  it('lets a dev run navigate within the dev renderer origin only', () => {
    const spy = createWebContentsSpy();
    applyPolicy(spy.contents, {
      openExternal: vi.fn<(url: string) => Promise<void>>().mockResolvedValue(undefined),
      log: createLogSpy(),
      internalUrls: [DEV_RENDERER],
    });

    expect(spy.navigate(`${DEV_RENDERER}/live`)).toEqual({ prevented: false });
    expect(spy.navigate('http://127.0.0.1:3001/live')).toEqual({ prevented: true });
  });

  it('refuses a subframe navigation to a foreign origin', () => {
    const openExternal = vi.fn<(url: string) => Promise<void>>().mockResolvedValue(undefined);
    const log = createLogSpy();
    const spy = createWebContentsSpy();
    applyPolicy(spy.contents, { openExternal, log });

    expect(spy.navigateFrame(STEAM_LISTING)).toEqual({ prevented: true });
    expect(spy.navigateFrame('data:text/html,x')).toEqual({ prevented: true });
    expect(openExternal).not.toHaveBeenCalled();
    expect(log.records).toContainEqual(
      expect.objectContaining({ event: 'navigation.blocked', trigger: 'will-frame-navigate', url: STEAM_LISTING }),
    );
  });

  it('lets a subframe stay on the app origin or an empty document', () => {
    const spy = createWebContentsSpy();
    applyPolicy(spy.contents, {
      openExternal: vi.fn<(url: string) => Promise<void>>().mockResolvedValue(undefined),
      log: createLogSpy(),
    });

    expect(spy.navigateFrame('app://bundle/index.html')).toEqual({ prevented: false });
    expect(spy.navigateFrame('about:blank')).toEqual({ prevented: false });
    expect(spy.navigateFrame('about:srcdoc')).toEqual({ prevented: false });
  });

  it('refuses a redirect off the app origin, in the main frame and in a subframe', () => {
    const openExternal = vi.fn<(url: string) => Promise<void>>().mockResolvedValue(undefined);
    const log = createLogSpy();
    const spy = createWebContentsSpy();
    applyPolicy(spy.contents, { openExternal, log, internalUrls: [DEV_RENDERER] });

    expect(spy.redirect(STEAM_LISTING, { isMainFrame: true })).toEqual({ prevented: true });
    expect(spy.redirect(STEAM_LISTING, { isMainFrame: false })).toEqual({ prevented: true });
    expect(spy.redirect(`${DEV_RENDERER}/live`, { isMainFrame: true })).toEqual({ prevented: false });
    expect(spy.redirect('about:blank', { isMainFrame: true })).toEqual({ prevented: true });
    expect(spy.redirect('about:blank', { isMainFrame: false })).toEqual({ prevented: false });
    expect(openExternal).not.toHaveBeenCalled();
    expect(log.records).toContainEqual(
      expect.objectContaining({ event: 'navigation.blocked', trigger: 'will-redirect', url: STEAM_LISTING }),
    );
  });

  it('leaves the main frame to the top-level handler', () => {
    const spy = createWebContentsSpy();
    applyPolicy(spy.contents, {
      openExternal: vi.fn<(url: string) => Promise<void>>().mockResolvedValue(undefined),
      log: createLogSpy(),
    });

    expect(spy.navigateFrame(STEAM_LISTING, { isMainFrame: true })).toEqual({ prevented: false });
  });

  it('logs a failure to hand the url to the browser', async () => {
    const openExternal = vi
      .fn<(url: string) => Promise<void>>()
      .mockRejectedValue(new Error('no browser'));
    const log = createLogSpy();
    const spy = createWebContentsSpy();
    applyPolicy(spy.contents, { openExternal, log });

    spy.openWindow(STEAM_LISTING);
    await vi.waitFor(() => {
      expect(log.records).toContainEqual(
        expect.objectContaining({ event: 'navigation.open_external_failed' }),
      );
    });
  });

  describe('a navigation the page starts by itself that commits off the app origin', () => {
    function setup(overrides: Partial<Parameters<typeof applyPolicy>[1]> = {}) {
      const spy = createWebContentsSpy();
      const log = createLogSpy();
      applyPolicy(spy.contents, {
        openExternal: vi.fn<(url: string) => Promise<void>>().mockResolvedValue(undefined),
        log,
        ...overrides,
      });
      return { spy, log };
    }

    it('loads the entry page again when the page itself lands on about:blank', async () => {
      const { spy, log } = setup({ entryUrl: 'app://bundle/mini-live/index.html' });

      await spy.startNavigation('about:blank');
      expect(spy.loadURL).not.toHaveBeenCalled();
      await spy.commit('about:blank');

      expect(spy.loadURL).toHaveBeenCalledExactlyOnceWith('app://bundle/mini-live/index.html');
      expect(log.records).toContainEqual(
        expect.objectContaining({ event: 'navigation.blocked', trigger: 'did-navigate', url: 'about:blank' }),
      );
    });

    it.each(['about:blank', 'about:srcdoc', 'data:text/html,x', 'https://example.com/', 'blob:app://bundle/1'])(
      'recovers from a commit to %s',
      async (url) => {
        const { spy } = setup();
        await spy.startNavigation(url);
        await spy.commit(url);
        expect(spy.loadURL).toHaveBeenCalledWith(RENDERER_ENTRY);
      },
    );

    it('does not reload the page for a navigation the policy refused, which never commits', async () => {
      const { spy } = setup();

      await spy.startNavigation(STEAM_LISTING);
      expect(spy.navigate(STEAM_LISTING)).toEqual({ prevented: true });
      await spy.commit(RENDERER_ENTRY);

      expect(spy.loadURL).not.toHaveBeenCalled();
    });

    it.each(['app://bundle/live', 'app://bundle/index.html?x=1#y'])('leaves an in-app commit to %s alone', async (url) => {
      const { spy } = setup();
      await spy.startNavigation(url);
      await spy.commit(url);
      expect(spy.loadURL).not.toHaveBeenCalled();
    });

    it('leaves a same-document route change alone', async () => {
      const { spy } = setup();
      await spy.startNavigation('about:blank', { isSameDocument: true });
      await spy.commit('about:blank');
      expect(spy.loadURL).not.toHaveBeenCalled();
    });

    it('leaves a subframe to the frame handler', async () => {
      const { spy } = setup();
      await spy.startNavigation('about:blank', { isMainFrame: false });
      await spy.commit('about:blank');
      expect(spy.loadURL).not.toHaveBeenCalled();
    });

    it('leaves a load the main process started itself alone, so its own recovery cannot loop', async () => {
      const { spy } = setup();
      await spy.startNavigation('about:blank', { initiated: false });
      await spy.commit('about:blank');
      expect(spy.loadURL).not.toHaveBeenCalled();
    });

    it('does not carry one navigation over to the next commit', async () => {
      const { spy } = setup();
      await spy.startNavigation('about:blank');
      await spy.commit(RENDERER_ENTRY);
      await spy.commit('about:blank');
      expect(spy.loadURL).not.toHaveBeenCalled();
    });

    it('allows the dev origin and sends a foreign one back to the entry page in a dev run', async () => {
      const { spy } = setup({ internalUrls: [DEV_RENDERER], entryUrl: `${DEV_RENDERER}/` });
      await spy.startNavigation(`${DEV_RENDERER}/live`);
      await spy.commit(`${DEV_RENDERER}/live`);
      expect(spy.loadURL).not.toHaveBeenCalled();
      await spy.startNavigation('http://127.0.0.1:3001/');
      await spy.commit('http://127.0.0.1:3001/');
      expect(spy.loadURL).toHaveBeenCalledExactlyOnceWith(`${DEV_RENDERER}/`);
    });

    it('logs a recovery that fails instead of throwing', async () => {
      const { spy, log } = setup();
      spy.loadURL.mockRejectedValueOnce(new Error('aborted'));
      await spy.startNavigation('about:blank');
      await spy.commit('about:blank');
      await vi.waitFor(() => {
        expect(log.records).toContainEqual(expect.objectContaining({ event: 'navigation.recover_failed' }));
      });
    });
  });
});

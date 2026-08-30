import { describe, expect, it, vi } from 'vitest';
import type { WebContents } from 'electron';
import { applyExternalNavigationPolicy, decideNavigation } from './external-navigation.js';
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

interface NavigateDetails {
  url: string;
  preventDefault(): void;
}

function createWebContentsSpy(): {
  contents: WebContents;
  openWindow(url: string): { action: string };
  navigate(url: string): { prevented: boolean };
} {
  let openHandler: ((details: { url: string }) => { action: string }) | null = null;
  let navigateListener: ((details: NavigateDetails) => void) | null = null;

  const contents = {
    setWindowOpenHandler(handler: (details: { url: string }) => { action: string }) {
      openHandler = handler;
    },
    on(event: string, listener: (details: NavigateDetails) => void) {
      if (event === 'will-navigate') {
        navigateListener = listener;
      }
      return contents;
    },
  };

  return {
    contents: contents as unknown as WebContents,
    openWindow(url) {
      if (!openHandler) {
        throw new Error('no window-open handler registered');
      }
      return openHandler({ url });
    },
    navigate(url) {
      if (!navigateListener) {
        throw new Error('no will-navigate listener registered');
      }
      let prevented = false;
      navigateListener({
        url,
        preventDefault: () => {
          prevented = true;
        },
      });
      return { prevented };
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

describe('applyExternalNavigationPolicy', () => {
  it('hands a target=_blank https link to the browser and creates no in-app window', () => {
    const openExternal = vi.fn<(url: string) => Promise<void>>().mockResolvedValue(undefined);
    const spy = createWebContentsSpy();
    applyExternalNavigationPolicy(spy.contents, { openExternal, log: createLogSpy() });

    expect(spy.openWindow(STEAM_LISTING)).toEqual({ action: 'deny' });
    expect(openExternal).toHaveBeenCalledWith(STEAM_LISTING);
  });

  it('never hands a non-https window-open url to the browser', () => {
    const openExternal = vi.fn<(url: string) => Promise<void>>().mockResolvedValue(undefined);
    const log = createLogSpy();
    const spy = createWebContentsSpy();
    applyExternalNavigationPolicy(spy.contents, { openExternal, log });

    expect(spy.openWindow('javascript:alert(1)')).toEqual({ action: 'deny' });
    expect(openExternal).not.toHaveBeenCalled();
    expect(log.records).toContainEqual(
      expect.objectContaining({ event: 'navigation.blocked', url: 'javascript:alert(1)' }),
    );
  });

  it('sends an in-page link to the browser instead of navigating the app away', () => {
    const openExternal = vi.fn<(url: string) => Promise<void>>().mockResolvedValue(undefined);
    const spy = createWebContentsSpy();
    applyExternalNavigationPolicy(spy.contents, { openExternal, log: createLogSpy() });

    expect(spy.navigate(STEAM_LISTING)).toEqual({ prevented: true });
    expect(openExternal).toHaveBeenCalledWith(STEAM_LISTING);
  });

  it('lets the renderer navigate within its own bundle', () => {
    const openExternal = vi.fn<(url: string) => Promise<void>>().mockResolvedValue(undefined);
    const spy = createWebContentsSpy();
    applyExternalNavigationPolicy(spy.contents, { openExternal, log: createLogSpy() });

    expect(spy.navigate('app://bundle/live')).toEqual({ prevented: false });
    expect(openExternal).not.toHaveBeenCalled();
  });

  it('logs a failure to hand the url to the browser', async () => {
    const openExternal = vi
      .fn<(url: string) => Promise<void>>()
      .mockRejectedValue(new Error('no browser'));
    const log = createLogSpy();
    const spy = createWebContentsSpy();
    applyExternalNavigationPolicy(spy.contents, { openExternal, log });

    spy.openWindow(STEAM_LISTING);
    await vi.waitFor(() => {
      expect(log.records).toContainEqual(
        expect.objectContaining({ event: 'navigation.open_external_failed' }),
      );
    });
  });
});

import { describe, expect, it } from 'vitest';
import { overlayInsetFrom } from './window-overlay';

describe('overlayInsetFrom', () => {
  it('reserves the gap between the titlebar-safe area and the window edge', () => {
    expect(overlayInsetFrom({ visible: true, getTitlebarAreaRect: () => ({ right: 1180 }) }, 1280)).toBe(100);
  });

  it('is zero once the safe area reaches the window edge', () => {
    expect(overlayInsetFrom({ visible: true, getTitlebarAreaRect: () => ({ right: 1280 }) }, 1280)).toBe(0);
  });

  it('is zero when the overlay is not visible', () => {
    expect(overlayInsetFrom({ visible: false, getTitlebarAreaRect: () => ({ right: 1180 }) }, 1280)).toBe(0);
  });

  it('is zero when there is no overlay API at all', () => {
    expect(overlayInsetFrom(undefined, 1280)).toBe(0);
  });
});

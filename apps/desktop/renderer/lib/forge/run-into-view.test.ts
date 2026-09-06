import { describe, expect, it } from 'vitest';
import { scrollDeltaIntoView } from './run-into-view';

const PORT = { top: 0, bottom: 600 };

describe('scrollDeltaIntoView', () => {
  it('leaves a band that is wholly on screen exactly where it is', () => {
    expect(scrollDeltaIntoView({ top: 100, bottom: 300 }, PORT)).toBe(0);
  });

  it('leaves a band flush against either edge alone', () => {
    expect(scrollDeltaIntoView({ top: 0, bottom: 600 }, PORT)).toBe(0);
  });

  it('scrolls down by just what hangs below the port', () => {
    expect(scrollDeltaIntoView({ top: 500, bottom: 720 }, PORT)).toBe(120);
  });

  it('scrolls up by just what sits above the port', () => {
    expect(scrollDeltaIntoView({ top: -40, bottom: 200 }, PORT)).toBe(-40);
  });

  it('stops at the band top for a band taller than the port, rather than scrolling its start off', () => {
    expect(scrollDeltaIntoView({ top: 50, bottom: 900 }, PORT)).toBe(50);
  });

  it('reads the port from its own top, not from the page', () => {
    expect(scrollDeltaIntoView({ top: 700, bottom: 800 }, { top: 120, bottom: 760 })).toBe(40);
  });
});

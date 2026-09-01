import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MAIN_HEIGHT,
  DEFAULT_MAIN_WIDTH,
  MIN_MAIN_HEIGHT,
  MIN_MAIN_WIDTH,
  clampToWorkArea,
  type MainWindowLayout,
  type WorkArea,
} from './window-layout.js';

const PRIMARY: WorkArea = { x: 0, y: 0, width: 1920, height: 1080 };
const SECONDARY: WorkArea = { x: 1920, y: 0, width: 1920, height: 1080 };

describe('clampToWorkArea', () => {
  it('uses default 1280x800 centered in the primary work area when nothing is stored', () => {
    const result = clampToWorkArea({
      stored: null,
      displays: [{ id: 1, workArea: PRIMARY }],
      primaryWorkArea: PRIMARY,
      minWidth: MIN_MAIN_WIDTH,
      minHeight: MIN_MAIN_HEIGHT,
      defaultWidth: DEFAULT_MAIN_WIDTH,
      defaultHeight: DEFAULT_MAIN_HEIGHT,
    });

    expect(result).toEqual({
      bounds: { x: 320, y: 140, width: 1280, height: 800 },
      isMaximized: false,
      displayMissing: false,
    });
  });

  it('honours minima when the primary work area is smaller than the defaults', () => {
    const smallPrimary: WorkArea = { x: 0, y: 0, width: 1000, height: 700 };

    const result = clampToWorkArea({
      stored: null,
      displays: [{ id: 1, workArea: smallPrimary }],
      primaryWorkArea: smallPrimary,
      minWidth: MIN_MAIN_WIDTH,
      minHeight: MIN_MAIN_HEIGHT,
      defaultWidth: DEFAULT_MAIN_WIDTH,
      defaultHeight: DEFAULT_MAIN_HEIGHT,
    });

    expect(result.bounds.width).toBe(1000);
    expect(result.bounds.height).toBe(700);
    expect(result.isMaximized).toBe(false);
  });

  it('applies a stored offset on the matching display and clamps fully inside that work area', () => {
    const stored: MainWindowLayout = {
      displayId: 2,
      x: 50,
      y: 40,
      width: 1400,
      height: 900,
      isMaximized: false,
    };

    const result = clampToWorkArea({
      stored,
      displays: [
        { id: 1, workArea: PRIMARY },
        { id: 2, workArea: SECONDARY },
      ],
      primaryWorkArea: PRIMARY,
      minWidth: MIN_MAIN_WIDTH,
      minHeight: MIN_MAIN_HEIGHT,
      defaultWidth: DEFAULT_MAIN_WIDTH,
      defaultHeight: DEFAULT_MAIN_HEIGHT,
    });

    expect(result).toEqual({
      bounds: { x: 1970, y: 40, width: 1400, height: 900 },
      isMaximized: false,
      displayMissing: false,
    });
  });

  it('pulls a partially off-screen stored window fully into the matching display', () => {
    const stored: MainWindowLayout = {
      displayId: 1,
      x: 1700,
      y: 900,
      width: 1280,
      height: 800,
      isMaximized: false,
    };

    const result = clampToWorkArea({
      stored,
      displays: [{ id: 1, workArea: PRIMARY }],
      primaryWorkArea: PRIMARY,
      minWidth: MIN_MAIN_WIDTH,
      minHeight: MIN_MAIN_HEIGHT,
      defaultWidth: DEFAULT_MAIN_WIDTH,
      defaultHeight: DEFAULT_MAIN_HEIGHT,
    });

    expect(result.bounds).toEqual({ x: 640, y: 280, width: 1280, height: 800 });
    expect(result.displayMissing).toBe(false);
  });

  it('clamps into the primary work area when the stored display is gone', () => {
    const stored: MainWindowLayout = {
      displayId: 99,
      x: 100,
      y: 80,
      width: 1280,
      height: 800,
      isMaximized: false,
    };

    const result = clampToWorkArea({
      stored,
      displays: [{ id: 1, workArea: PRIMARY }],
      primaryWorkArea: PRIMARY,
      minWidth: MIN_MAIN_WIDTH,
      minHeight: MIN_MAIN_HEIGHT,
      defaultWidth: DEFAULT_MAIN_WIDTH,
      defaultHeight: DEFAULT_MAIN_HEIGHT,
    });

    expect(result.bounds).toEqual({ x: 100, y: 80, width: 1280, height: 800 });
    expect(result.displayMissing).toBe(true);
  });

  it('preserves isMaximized through clamp', () => {
    const stored: MainWindowLayout = {
      displayId: 1,
      x: 100,
      y: 80,
      width: 1280,
      height: 800,
      isMaximized: true,
    };

    const result = clampToWorkArea({
      stored,
      displays: [{ id: 1, workArea: PRIMARY }],
      primaryWorkArea: PRIMARY,
      minWidth: MIN_MAIN_WIDTH,
      minHeight: MIN_MAIN_HEIGHT,
      defaultWidth: DEFAULT_MAIN_WIDTH,
      defaultHeight: DEFAULT_MAIN_HEIGHT,
    });

    expect(result.isMaximized).toBe(true);
  });
});

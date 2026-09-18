import { describe, expect, it } from 'vitest';
import { SKILL_TREE_LAYOUT } from '@bombfarm/domain/skill-tree';
import {
  arcPath,
  centreViewBox,
  clampPan,
  layoutExtent,
  pixelToUser,
  progressFraction,
  userToPixel,
  viewBoxContains,
  zoomOf,
  zoomViewBox,
} from './tree-geometry';

const extent = layoutExtent(SKILL_TREE_LAYOUT);

describe('layoutExtent', () => {
  it('wraps every medallion in the game layout plus the margin', () => {
    expect(extent.x).toBeLessThan(-1096);
    expect(extent.y).toBeLessThan(-822);
    expect(extent.x + extent.w).toBeGreaterThan(774);
    expect(extent.y + extent.h).toBeGreaterThan(822);
    expect(extent.w).toBeLessThan(774 + 1096 + 200);
  });
});

describe('zoomViewBox', () => {
  it('keeps the anchor under the pointer while scaling', () => {
    const anchor = { x: 200, y: -100 };
    const zoomed = zoomViewBox(extent, extent, 1.1, anchor);
    const size = { width: 1000, height: 800 };
    const before = userToPixel(extent, size, anchor);
    const after = userToPixel(zoomed, size, anchor);
    expect(after.x).toBeCloseTo(before.x, 6);
    expect(after.y).toBeCloseTo(before.y, 6);
    expect(zoomOf(zoomed, extent)).toBeCloseTo(1.1, 9);
  });

  it('clamps between the fit and six times the fit', () => {
    const centre = { x: 0, y: 0 };
    expect(zoomOf(zoomViewBox(extent, extent, 0.5, centre), extent)).toBe(1);
    let box = extent;
    for (let i = 0; i < 40; i++) box = zoomViewBox(box, extent, 1.1, centre);
    expect(zoomOf(box, extent)).toBeCloseTo(6, 9);
  });
});

describe('clampPan', () => {
  it('never lets the view centre leave the tree', () => {
    const far = clampPan({ ...extent, x: extent.x + 10_000, y: extent.y - 10_000 }, extent);
    expect(far.x + far.w / 2).toBe(extent.x + extent.w);
    expect(far.y + far.h / 2).toBe(extent.y);
  });

  it('centres on a point and reports when a point is inside the view', () => {
    const zoomed = zoomViewBox(extent, extent, 4, { x: 0, y: 0 });
    const target = { x: 700, y: 700 };
    expect(viewBoxContains(zoomed, target)).toBe(false);
    const moved = centreViewBox(zoomed, extent, target);
    expect(viewBoxContains(moved, target)).toBe(true);
    expect(moved.w).toBe(zoomed.w);
  });
});

describe('pixel ↔ user mapping', () => {
  it('round-trips through the letterboxed frame', () => {
    const size = { width: 640, height: 900 };
    const pixel = { x: 123, y: 456 };
    const back = userToPixel(extent, size, pixelToUser(extent, size, pixel));
    expect(back.x).toBeCloseTo(pixel.x, 9);
    expect(back.y).toBeCloseTo(pixel.y, 9);
  });
});

describe('progress ring', () => {
  it('clamps the fraction so a first level shows and a nearly-maxed node stays open', () => {
    expect(progressFraction(1, 100)).toBe(0.08);
    expect(progressFraction(99, 100)).toBe(0.96);
    expect(progressFraction(5, 10)).toBe(0.5);
  });

  it('draws the arc from 12 o clock clockwise with the large flag past half', () => {
    expect(arcPath(10, 0.25)).toBe('M 0 -10 A 10 10 0 0 1 10 0');
    expect(arcPath(10, 0.75)).toBe('M 0 -10 A 10 10 0 1 1 -10 0');
  });
});

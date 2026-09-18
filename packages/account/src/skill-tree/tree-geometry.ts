import type { SkillTreeLayout } from '@bombfarm/domain/skill-tree';

export type ViewBox = { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
export type Point = { readonly x: number; readonly y: number };
export type Size = { readonly width: number; readonly height: number };

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 6;
export const WHEEL_ZOOM_STEP = 1.1;
export const DRAG_DEAD_ZONE_PX = 6;
export const LAYOUT_MARGIN = 40;

/** The whole tree with a margin around it — the view that fits everything, and the zoom-1 frame. */
export function layoutExtent(layout: SkillTreeLayout, margin = LAYOUT_MARGIN): ViewBox {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const node of Object.values(layout.nodes)) {
    const r = node.diameter / 2;
    minX = Math.min(minX, node.x - r);
    minY = Math.min(minY, node.y - r);
    maxX = Math.max(maxX, node.x + r);
    maxY = Math.max(maxY, node.y + r);
  }
  if (!Number.isFinite(minX)) return { x: -margin, y: -margin, w: 2 * margin, h: 2 * margin };
  return { x: minX - margin, y: minY - margin, w: maxX - minX + 2 * margin, h: maxY - minY + 2 * margin };
}

export function zoomOf(viewBox: ViewBox, extent: ViewBox): number {
  return extent.w / viewBox.w;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Keeps the view's centre inside the tree, so a pan can never leave the tree entirely off-screen. */
export function clampPan(viewBox: ViewBox, extent: ViewBox): ViewBox {
  const cx = clamp(viewBox.x + viewBox.w / 2, extent.x, extent.x + extent.w);
  const cy = clamp(viewBox.y + viewBox.h / 2, extent.y, extent.y + extent.h);
  return { x: cx - viewBox.w / 2, y: cy - viewBox.h / 2, w: viewBox.w, h: viewBox.h };
}

/** Scales the view by `factor` about `anchor` (user coordinates), within the zoom bounds. */
export function zoomViewBox(viewBox: ViewBox, extent: ViewBox, factor: number, anchor: Point): ViewBox {
  const zoom = zoomOf(viewBox, extent);
  const nextZoom = clamp(zoom * factor, MIN_ZOOM, MAX_ZOOM);
  const scale = zoom / nextZoom;
  return clampPan(
    {
      x: anchor.x - (anchor.x - viewBox.x) * scale,
      y: anchor.y - (anchor.y - viewBox.y) * scale,
      w: viewBox.w * scale,
      h: viewBox.h * scale,
    },
    extent,
  );
}

export function panViewBox(viewBox: ViewBox, extent: ViewBox, dx: number, dy: number): ViewBox {
  return clampPan({ ...viewBox, x: viewBox.x + dx, y: viewBox.y + dy }, extent);
}

export function centreViewBox(viewBox: ViewBox, extent: ViewBox, centre: Point): ViewBox {
  return clampPan({ ...viewBox, x: centre.x - viewBox.w / 2, y: centre.y - viewBox.h / 2 }, extent);
}

export function viewBoxCentre(viewBox: ViewBox): Point {
  return { x: viewBox.x + viewBox.w / 2, y: viewBox.y + viewBox.h / 2 };
}

export function viewBoxContains(viewBox: ViewBox, point: Point): boolean {
  return (
    point.x >= viewBox.x && point.x <= viewBox.x + viewBox.w && point.y >= viewBox.y && point.y <= viewBox.y + viewBox.h
  );
}

export function viewBoxAttribute(viewBox: ViewBox): string {
  return `${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`;
}

/** Pixels per user unit under `xMidYMid meet`, and where the view's origin lands in the box. */
function meetFrame(viewBox: ViewBox, size: Size): { scale: number; offsetX: number; offsetY: number } {
  const scale = Math.min(size.width / viewBox.w, size.height / viewBox.h);
  return {
    scale,
    offsetX: (size.width - viewBox.w * scale) / 2,
    offsetY: (size.height - viewBox.h * scale) / 2,
  };
}

export function userPerPixel(viewBox: ViewBox, size: Size): number {
  return 1 / meetFrame(viewBox, size).scale;
}

export function pixelToUser(viewBox: ViewBox, size: Size, pixel: Point): Point {
  const frame = meetFrame(viewBox, size);
  return {
    x: viewBox.x + (pixel.x - frame.offsetX) / frame.scale,
    y: viewBox.y + (pixel.y - frame.offsetY) / frame.scale,
  };
}

export function userToPixel(viewBox: ViewBox, size: Size, user: Point): Point {
  const frame = meetFrame(viewBox, size);
  return {
    x: frame.offsetX + (user.x - viewBox.x) * frame.scale,
    y: frame.offsetY + (user.y - viewBox.y) * frame.scale,
  };
}

export const PROGRESS_MIN_FRACTION = 0.08;
export const PROGRESS_MAX_FRACTION = 0.96;

/** How much of the ring an owned node's levels fill — never so little it vanishes, never closed. */
export function progressFraction(level: number, maxLevel: number): number {
  if (maxLevel <= 0) return PROGRESS_MIN_FRACTION;
  return clamp(level / maxLevel, PROGRESS_MIN_FRACTION, PROGRESS_MAX_FRACTION);
}

/** An arc of radius `r` about the origin, from 12 o'clock clockwise through `fraction` of a turn. */
export function arcPath(r: number, fraction: number): string {
  const angle = 2 * Math.PI * clamp(fraction, 0, 0.9999);
  const endX = r * Math.sin(angle);
  const endY = -r * Math.cos(angle);
  const large = fraction > 0.5 ? 1 : 0;
  return `M 0 ${-r} A ${r} ${r} 0 ${large} 1 ${round(endX)} ${round(endY)}`;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

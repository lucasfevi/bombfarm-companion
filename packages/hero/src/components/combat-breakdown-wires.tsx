'use client';

import { useEffect, useState, type RefObject } from 'react';
import type { BreakdownStatId } from '@bombfarm/domain/stat-breakdown';
import { COMBAT_BREAKDOWN_EDGES } from '../model/combat-breakdown';

type Box = { x: number; y: number; w: number; h: number };
type Geometry = { width: number; height: number; boxes: Partial<Record<BreakdownStatId, Box>> };

function measure(container: HTMLElement, cards: ReadonlyMap<BreakdownStatId, HTMLElement>): Geometry {
  const origin = container.getBoundingClientRect();
  const boxes: Partial<Record<BreakdownStatId, Box>> = {};
  for (const [id, element] of cards) {
    const rect = element.getBoundingClientRect();
    boxes[id] = { x: rect.left - origin.left, y: rect.top - origin.top, w: rect.width, h: rect.height };
  }
  return { width: origin.width, height: origin.height, boxes };
}

const SAME_ROW_DIP = 14;

/** Bottom-centre to top-centre for a card in a lower row; two cards in one row (Hit feeding
 *  Critical hit and Average hit beside it) are joined by a shallow arc under both. */
function wirePath(from: Box, to: Box): string {
  const x1 = from.x + from.w / 2;
  const x2 = to.x + to.w / 2;
  const y1 = from.y + from.h;
  if (Math.abs(from.y - to.y) < 1) {
    const dip = y1 + SAME_ROW_DIP;
    return `M${x1} ${y1} C${x1} ${dip}, ${x2} ${dip}, ${x2} ${y1}`;
  }
  const y2 = to.y;
  const bend = (y1 + y2) / 2;
  return `M${x1} ${y1} C${x1} ${bend}, ${x2} ${bend}, ${x2} ${y2}`;
}

/**
 * The curves between the cards that feed each other, drawn over the rows once the cards have
 * been laid out. Positions are measured, not assumed — the rows centre themselves and the panel
 * decides its own width — so nothing is drawn until the first measurement on the client, and
 * the static export carries no wires to mismatch against.
 */
export function CombatBreakdownWires({
  containerRef,
  cards,
  lit,
}: {
  containerRef: RefObject<HTMLElement | null>;
  cards: RefObject<Map<BreakdownStatId, HTMLElement>>;
  lit: BreakdownStatId | null;
}) {
  const [geometry, setGeometry] = useState<Geometry | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return;
    const update = () => setGeometry(measure(container, cards.current));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(container);
    return () => observer.disconnect();
  }, [containerRef, cards]);

  if (!geometry) return null;

  return (
    <svg
      className="pointer-events-none absolute inset-0 hidden @min-[820px]:block"
      width={geometry.width}
      height={geometry.height}
      viewBox={`0 0 ${geometry.width} ${geometry.height}`}
      aria-hidden="true"
      data-testid="breakdown-wires"
    >
      {COMBAT_BREAKDOWN_EDGES.map((edge) => {
        const from = geometry.boxes[edge.from];
        const to = geometry.boxes[edge.to];
        if (!from || !to) return null;
        const isLit = lit === edge.to || lit === edge.from;
        return (
          <path
            key={`${edge.from}-${edge.to}`}
            d={wirePath(from, to)}
            fill="none"
            className={isLit ? 'stroke-accent' : 'stroke-line'}
            strokeWidth={isLit ? 2 : 1.25}
            opacity={lit && !isLit ? 0.3 : 1}
            data-edge-from={edge.from}
            data-edge-to={edge.to}
            data-lit={isLit ? 'true' : undefined}
          />
        );
      })}
    </svg>
  );
}

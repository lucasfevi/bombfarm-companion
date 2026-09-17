'use client';

import {
  memo,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import type {
  SkillNode,
  SkillNodeGain,
  SkillNodeLayout,
  SkillNodeStatus,
  SkillPricingObjective,
  SkillTreeCatalog,
  SkillTreeLayout,
} from '@bombfarm/domain/skill-tree';
import { Button, cn, tooltipPopupRecipe } from '@bombfarm/ui';
import { edgeToneOf, effectTotalAt, objectiveDelta, visualStateOf, type EdgeTone, type NodeVisualState } from './node-facts';
import {
  DRAG_DEAD_ZONE_PX,
  MAX_ZOOM,
  MIN_ZOOM,
  WHEEL_ZOOM_STEP,
  arcPath,
  centreViewBox,
  layoutExtent,
  pixelToUser,
  progressFraction,
  userPerPixel,
  userToPixel,
  viewBoxAttribute,
  viewBoxCentre,
  viewBoxContains,
  zoomOf,
  zoomViewBox,
  type Point,
  type Size,
  type ViewBox,
} from './tree-geometry';
import type { SkillTreeLabels } from './types';

export type SkillTreeCanvasProps = {
  catalog: SkillTreeCatalog;
  layout: SkillTreeLayout;
  statuses: ReadonlyMap<string, SkillNodeStatus>;
  gains: ReadonlyMap<string, SkillNodeGain>;
  objective: SkillPricingObjective;
  selectedId: string | null;
  recommendedId: string | null;
  onSelect: (id: string | null) => void;
  nodeArtSrc: (node: SkillNode) => string | null;
  nodeName: (node: SkillNode) => string;
  labels: SkillTreeLabels;
};

const NODE_ID_ATTR = 'data-node-id';

const EDGE_STYLE: Record<EdgeTone, { stroke: string; width: number; opacity: number }> = {
  owned: { stroke: 'var(--gold)', width: 3, opacity: 0.9 },
  buyable: { stroke: 'var(--gold)', width: 2, opacity: 0.4 },
  locked: { stroke: 'var(--line)', width: 1.5, opacity: 0.6 },
};

const RING_STROKE: Record<NodeVisualState, string | null> = {
  lit: 'var(--gold)',
  owned: null,
  maxed: 'var(--gold)',
  buyable: 'var(--gold)',
  unaffordable: 'color-mix(in oklch, var(--down) 65%, var(--gold))',
  locked: 'var(--line)',
};

function nodeIdOf(target: EventTarget | null): string | null {
  if (!(target instanceof Element)) return null;
  return target.closest(`[${NODE_ID_ATTR}]`)?.getAttribute(NODE_ID_ATTR) ?? null;
}

type NodeMedallionProps = {
  node: SkillNode;
  place: SkillNodeLayout;
  state: NodeVisualState;
  level: number;
  selected: boolean;
  recommended: boolean;
  artSrc: string | null;
  clipId: string;
  glowId: string;
  ariaLabel: string;
};

/** Written out by hand: no compiler memoises a package a host transpiles, and 132 of these redraw on every hover. */
const NodeMedallion = memo(function NodeMedallion({
  node,
  place,
  state,
  level,
  selected,
  recommended,
  artSrc,
  clipId,
  glowId,
  ariaLabel,
}: NodeMedallionProps) {
  const r = place.diameter / 2;
  const ring = RING_STROKE[state];
  const owned = state === 'owned';
  const maxed = state === 'maxed';
  const badgeFont = Math.max(7, r * 0.42);
  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
      aria-pressed={selected}
      data-node-id={node.id}
      data-state={state}
      data-recommended={recommended || undefined}
      transform={`translate(${place.x} ${place.y})`}
      className={cn(
        'group cursor-pointer outline-none',
        state === 'locked' && 'opacity-35 grayscale',
      )}
    >
      {owned || maxed ? (
        <circle r={r * 1.3} fill="var(--gold)" opacity={maxed ? 0.3 : 0.22} filter={`url(#${glowId})`} />
      ) : null}
      {selected ? <circle r={r + 9} fill="none" stroke="var(--accent)" strokeWidth={2.5} /> : null}
      <circle
        r={r + 9}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={2.5}
        className="opacity-0 group-focus-visible:opacity-100"
      />
      {recommended ? (
        <circle
          r={r + 5}
          fill="none"
          stroke="var(--up)"
          strokeWidth={2.2}
          strokeDasharray="6 4"
          className="motion-safe:animate-pulse"
        />
      ) : null}
      <circle r={r} fill="var(--bg)" />
      {artSrc === null ? (
        <circle r={r - 1} fill="var(--bg-2)" stroke="var(--muted)" strokeWidth={1} />
      ) : (
        <image href={artSrc} x={-r} y={-r} width={place.diameter} height={place.diameter} clipPath={`url(#${clipId})`} />
      )}
      {ring !== null ? <circle r={r + 1.3} fill="none" stroke={ring} strokeWidth={maxed ? 3.2 : 2} /> : null}
      {maxed ? <circle r={r + 5} fill="none" stroke="var(--gold)" strokeWidth={3} opacity={0.25} /> : null}
      {owned ? (
        <path
          d={arcPath(r + 1.3, progressFraction(level, node.maxLevel))}
          fill="none"
          stroke="var(--gold)"
          strokeWidth={2.6}
          strokeLinecap="round"
        />
      ) : null}
      {owned || maxed ? (
        <g transform={`translate(${r * 0.55} ${r * 0.7})`}>
          <rect
            x={-badgeFont * 1.35}
            y={-badgeFont * 0.75}
            width={badgeFont * 2.7}
            height={badgeFont * 1.5}
            rx={badgeFont * 0.75}
            fill="var(--bg)"
            stroke="var(--gold)"
            strokeWidth={0.8}
          />
          <text
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={badgeFont}
            fill="var(--ink)"
            className="font-mono font-semibold select-none"
          >
            {level}/{node.maxLevel}
          </text>
        </g>
      ) : null}
    </g>
  );
});

type HoverCardProps = {
  node: SkillNode;
  status: SkillNodeStatus;
  gain: SkillNodeGain | undefined;
  objective: SkillPricingObjective;
  position: Point;
  bounds: Size;
  nodeName: string;
  labels: SkillTreeLabels;
};

const HOVER_CARD_WIDTH = 240;

function HoverCard({ node, status, gain, objective, position, bounds, nodeName, labels }: HoverCardProps) {
  const left = position.x + 14 + HOVER_CARD_WIDTH > bounds.width ? position.x - 14 - HOVER_CARD_WIDTH : position.x + 14;
  const top = Math.max(4, Math.min(position.y - 12, bounds.height - 140));
  const nextLevel = Math.min(node.maxLevel, status.level + 1);
  const delta = gain ? objectiveDelta(gain, objective) : null;
  return (
    <div
      role="tooltip"
      data-testid="skill-tree-hover-card"
      className={cn(tooltipPopupRecipe({ tone: 'default' }), 'pointer-events-none absolute flex w-60 flex-col gap-1')}
      style={{ left, top }}
    >
      <p className="m-0 font-semibold text-ink">{nodeName}</p>
      <p className="m-0 text-[11px] text-muted">
        {labels.armName(node.arm)} · {labels.level(status.level, status.maxLevel)}
      </p>
      {node.effects.map((effect) => (
        <p key={effect.kind} className="m-0 text-[11px]">
          {labels.effectAtLevel(effect.kind, effectTotalAt(effect, nextLevel))}
        </p>
      ))}
      {status.nextCost !== null ? (
        <p className="m-0 font-mono text-[11px] text-gold">
          {labels.nextLevelCost}: {labels.goldCompact(status.nextCost)}
        </p>
      ) : null}
      {delta !== null && delta !== undefined ? (
        <p className={cn('m-0 font-mono text-[11px]', delta < 0 ? 'text-down' : 'text-up')}>
          {objective === 'goldPerHour' ? labels.gainGold(delta) : labels.gainDps(delta)}
        </p>
      ) : null}
    </div>
  );
}

type Drag = {
  readonly startX: number;
  readonly startY: number;
  readonly viewBox: ViewBox;
  readonly nodeId: string | null;
  moved: boolean;
};

export function SkillTreeCanvas({
  catalog,
  layout,
  statuses,
  gains,
  objective,
  selectedId,
  recommendedId,
  onSelect,
  nodeArtSrc,
  nodeName,
  labels,
}: SkillTreeCanvasProps) {
  const extent = useMemo(() => layoutExtent(layout), [layout]);
  const [viewBox, setViewBox] = useState<ViewBox>(extent);
  const [size, setSize] = useState<Size | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<Drag | null>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const idBase = useId();
  const glowId = `${idBase}-glow`;
  const clipIdFor = (diameter: number) => `${idBase}-clip-${String(diameter).replace('.', '_')}`;

  const diameters = useMemo(
    () => [...new Set(Object.values(layout.nodes).map((place) => place.diameter))],
    [layout],
  );

  useEffect(() => {
    setViewBox(extent);
  }, [extent]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || typeof ResizeObserver === 'undefined') return;
    const measure = () => {
      const rect = host.getBoundingClientRect();
      setSize({ width: rect.width, height: rect.height });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  const measured = useCallback((): Size => {
    const rect = hostRef.current?.getBoundingClientRect();
    return rect ? { width: rect.width, height: rect.height } : { width: extent.w, height: extent.h };
  }, [extent]);

  // React registers wheel listeners passively, and a passive listener cannot keep the page from
  // scrolling under the tree — so this one is attached by hand.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = svg.getBoundingClientRect();
      const box = { width: rect.width, height: rect.height };
      const factor = event.deltaY < 0 ? WHEEL_ZOOM_STEP : 1 / WHEEL_ZOOM_STEP;
      setViewBox((current) =>
        zoomViewBox(current, extent, factor, pixelToUser(current, box, { x: event.clientX - rect.left, y: event.clientY - rect.top })),
      );
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, [extent]);

  useEffect(() => {
    if (selectedId === null) return;
    const place = layout.nodes[selectedId];
    if (!place) return;
    setViewBox((current) => (viewBoxContains(current, place) ? current : centreViewBox(current, extent, place)));
  }, [selectedId, layout, extent]);

  const zoomBy = (factor: number) => setViewBox((current) => zoomViewBox(current, extent, factor, viewBoxCentre(current)));
  const fit = () => setViewBox(extent);

  const onPointerDown = (event: PointerEvent<SVGSVGElement>) => {
    if (event.button !== 0) return;
    drag.current = { startX: event.clientX, startY: event.clientY, viewBox, nodeId: nodeIdOf(event.target), moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const current = drag.current;
    if (!current) return;
    const dx = event.clientX - current.startX;
    const dy = event.clientY - current.startY;
    if (!current.moved && Math.hypot(dx, dy) < DRAG_DEAD_ZONE_PX) return;
    if (!current.moved) {
      current.moved = true;
      setDragging(true);
      setHoverId(null);
    }
    const perPixel = userPerPixel(current.viewBox, measured());
    setViewBox(centreViewBox(current.viewBox, extent, {
      x: current.viewBox.x + current.viewBox.w / 2 - dx * perPixel,
      y: current.viewBox.y + current.viewBox.h / 2 - dy * perPixel,
    }));
  };

  const endDrag = (event: PointerEvent<SVGSVGElement>, select: boolean) => {
    const current = drag.current;
    drag.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (current && select && !current.moved) onSelect(current.nodeId);
  };

  const onPointerOver = (event: PointerEvent<SVGSVGElement>) => {
    if (drag.current?.moved) return;
    const id = nodeIdOf(event.target);
    if (id !== null) setHoverId(id);
  };

  const onPointerOut = (event: PointerEvent<SVGSVGElement>) => {
    const from = nodeIdOf(event.target);
    const to = nodeIdOf(event.relatedTarget);
    if (from !== null && from !== to) setHoverId((current) => (current === from ? null : current));
  };

  const onFocus = (event: FocusEvent<SVGSVGElement>) => {
    const id = nodeIdOf(event.target);
    if (id !== null) setHoverId(id);
  };

  const onBlur = (event: FocusEvent<SVGSVGElement>) => {
    const id = nodeIdOf(event.target);
    if (id !== null) setHoverId((current) => (current === id ? null : current));
  };

  const onKeyDown = (event: KeyboardEvent<SVGSVGElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const id = nodeIdOf(event.target);
    if (id === null) return;
    event.preventDefault();
    onSelect(id);
  };

  const hovered = hoverId === null ? null : catalog.nodes.find((node) => node.id === hoverId) ?? null;
  const hoveredStatus = hovered ? statuses.get(hovered.id) : undefined;
  const hoveredPlace = hovered ? layout.nodes[hovered.id] : undefined;
  const zoom = zoomOf(viewBox, extent);

  return (
    <div ref={hostRef} data-testid="skill-tree-canvas" className="relative h-[60vh] min-h-[360px] flex-1 overflow-hidden bg-bg min-[960px]:h-auto min-[960px]:min-h-0">
      <svg
        ref={svgRef}
        role="group"
        aria-label={labels.canvasAria}
        viewBox={viewBoxAttribute(viewBox)}
        preserveAspectRatio="xMidYMid meet"
        className={cn('block size-full touch-none overflow-hidden select-none', dragging ? 'cursor-grabbing' : 'cursor-grab')}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(event) => endDrag(event, true)}
        onPointerCancel={(event) => endDrag(event, false)}
        onPointerOver={onPointerOver}
        onPointerOut={onPointerOut}
        onFocus={onFocus}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
      >
        <defs>
          <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
          {diameters.map((diameter) => (
            <clipPath key={diameter} id={clipIdFor(diameter)} clipPathUnits="userSpaceOnUse">
              <circle r={diameter / 2} />
            </clipPath>
          ))}
        </defs>
        <g data-testid="skill-tree-edges">
          {catalog.nodes.map((node) => {
            const place = layout.nodes[node.id];
            const parentId = node.requires[0];
            const parent = parentId === undefined ? undefined : layout.nodes[parentId];
            const status = statuses.get(node.id);
            if (!place || !parent || !status) return null;
            const style = EDGE_STYLE[edgeToneOf(visualStateOf(status))];
            return (
              <line
                key={node.id}
                data-edge={node.id}
                data-tone={edgeToneOf(visualStateOf(status))}
                x1={parent.x}
                y1={parent.y}
                x2={place.x}
                y2={place.y}
                stroke={style.stroke}
                strokeWidth={style.width}
                opacity={style.opacity}
                strokeLinecap="round"
              />
            );
          })}
        </g>
        <g data-testid="skill-tree-nodes">
          {catalog.nodes.map((node) => {
            const place = layout.nodes[node.id];
            const status = statuses.get(node.id);
            if (!place || !status) return null;
            const name = nodeName(node);
            return (
              <NodeMedallion
                key={node.id}
                node={node}
                place={place}
                state={visualStateOf(status)}
                level={status.level}
                selected={selectedId === node.id}
                recommended={recommendedId === node.id}
                artSrc={nodeArtSrc(node)}
                clipId={clipIdFor(place.diameter)}
                glowId={glowId}
                ariaLabel={labels.nodeAria(name, status.level, status.maxLevel)}
              />
            );
          })}
        </g>
      </svg>
      <div className="absolute top-2 right-2 flex gap-1">
        <Button variant="ghost" className="px-2 py-1" onClick={() => zoomBy(1 / WHEEL_ZOOM_STEP ** 2)} disabled={zoom <= MIN_ZOOM}>
          {labels.zoomOut}
        </Button>
        <Button variant="ghost" className="px-2 py-1" onClick={() => zoomBy(WHEEL_ZOOM_STEP ** 2)} disabled={zoom >= MAX_ZOOM}>
          {labels.zoomIn}
        </Button>
        <Button variant="ghost" className="px-2 py-1" onClick={fit}>
          {labels.fitToView}
        </Button>
      </div>
      {hovered && hoveredStatus && hoveredPlace && size ? (
        <HoverCard
          node={hovered}
          status={hoveredStatus}
          gain={gains.get(hovered.id)}
          objective={objective}
          position={userToPixel(viewBox, size, { x: hoveredPlace.x + hoveredPlace.diameter / 2, y: hoveredPlace.y })}
          bounds={size}
          nodeName={nodeName(hovered)}
          labels={labels}
        />
      ) : null}
    </div>
  );
}

const LEGEND_SWATCH: Record<'owned' | 'buyable' | 'locked' | 'recommended', string> = {
  owned: 'border-gold bg-[color-mix(in_oklch,var(--gold)_35%,var(--bg))]',
  buyable: 'border-gold bg-bg',
  locked: 'border-line bg-bg-2 opacity-50',
  recommended: 'border-up border-dashed bg-bg',
};

export function SkillTreeLegend({ labels }: { labels: SkillTreeLabels }) {
  const items = [
    { id: 'owned', text: labels.legendOwned },
    { id: 'buyable', text: labels.legendBuyable },
    { id: 'locked', text: labels.legendLocked },
    { id: 'recommended', text: labels.legendRecommended },
  ] as const;
  return (
    <ul aria-label={labels.legend} className="m-0 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-[11px] text-muted">
      {items.map((item) => (
        <li key={item.id} className="flex items-center gap-1.5">
          <span aria-hidden className={cn('inline-block size-3 shrink-0 rounded-full border-2', LEGEND_SWATCH[item.id])} />
          {item.text}
        </li>
      ))}
    </ul>
  );
}

'use client';

import { useCallback, useRef, useState, type MouseEvent } from 'react';
import type { AppLocale, DomainLang, PvpDuelRow, PvpFilmSecond, PvpFilmView } from '@bombfarm/contracts';
import { BCP47_BY_LOCALE } from '@bombfarm/contracts';
import { Button, cn, FactTile, formatCompactNumber, Icon, Panel, PanelHeader, Tooltip } from '@bombfarm/ui';
import { sub, useCopy, useLocale, type Copy } from '../../lib/copy';
import { formatCount } from '../../lib/format';
import { usePvpFilm } from '../../lib/pvp/use-pvp-film';

const EM_DASH = '—';

const CHART = { width: 560, height: 150, left: 40, right: 12, top: 14, bottom: 20 } as const;
const PLOT_WIDTH = CHART.width - CHART.left - CHART.right;
const PLOT_HEIGHT = CHART.height - CHART.top - CHART.bottom;
const DASH = '4 3';
const END_DOT_RADIUS = 2.5;
const CURSOR_DOT_RADIUS = 3.5;

/** The y axis tops out at the larger final total rounded up to its leading digit — a round
 *  figure the labels can print, never a number the line happens to end on. */
export function roundAxisMax(value: number): number {
  if (!(value > 0)) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  return Math.ceil(value / magnitude) * magnitude;
}

function formatSigned(amount: number, locale: AppLocale): string {
  return new Intl.NumberFormat(BCP47_BY_LOCALE[locale], { signDisplay: 'exceptZero', maximumFractionDigits: 0 }).format(amount);
}

function formatPercent(fraction: number, locale: AppLocale): string {
  return new Intl.NumberFormat(BCP47_BY_LOCALE[locale], { style: 'percent', maximumFractionDigits: 0 }).format(fraction);
}

function xOf(second: number, seconds: number): number {
  return CHART.left + (seconds === 0 ? 0 : (second / seconds) * PLOT_WIDTH);
}

function yOf(fraction: number): number {
  return CHART.top + (1 - Math.min(1, Math.max(0, fraction))) * PLOT_HEIGHT;
}

function pointsOf(series: readonly PvpFilmSecond[], seconds: number, read: (second: PvpFilmSecond) => number): string {
  return series.map((second) => `${xOf(second.second, seconds).toFixed(1)},${yOf(read(second)).toFixed(1)}`).join(' ');
}

/** The second under the pointer, in the SVG's own frame: the drawing keeps its aspect ratio, so
 *  one scale maps the rendered width back onto the viewBox. Null a little outside the plot. */
export function secondAtPointer(clientX: number, rect: { left: number; width: number }, seconds: number): number | null {
  if (rect.width <= 0) return null;
  const x = ((clientX - rect.left) / rect.width) * CHART.width;
  const fraction = (x - CHART.left) / PLOT_WIDTH;
  if (fraction < -0.02 || fraction > 1.02) return null;
  return Math.round(Math.min(1, Math.max(0, fraction)) * seconds);
}

function ReplayChart({
  view,
  t,
  locale,
  lang,
  hovered,
  onHover,
}: {
  view: PvpFilmView;
  t: Copy;
  locale: AppLocale;
  lang: DomainLang;
  hovered: PvpFilmSecond | null;
  onHover: (second: number | null) => void;
}) {
  const { series, facts } = view;
  const last = series[series.length - 1];
  const seconds = Math.max(1, facts.seconds);
  const axisMax = roundAxisMax(Math.max(last?.attackerDamage ?? 0, last?.defenderDamage ?? 0));
  const attacker = pointsOf(series, seconds, (second) => second.attackerDamage / axisMax);
  const defender = pointsOf(series, seconds, (second) => second.defenderDamage / axisMax);
  const roomHp = pointsOf(series, seconds, (second) => second.roomHp);
  const hairlines = [0, 0.5, 1];
  const ticks = [0, seconds / 2, seconds];
  const svgRef = useRef<SVGSVGElement | null>(null);

  const onMouseMove = useCallback(
    (event: MouseEvent<SVGSVGElement>) => {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;
      onHover(secondAtPointer(event.clientX, rect, seconds));
    },
    [onHover, seconds],
  );

  return (
    <svg
      ref={svgRef}
      data-testid="pvp-replay-chart"
      data-hovered-second={hovered === null ? undefined : hovered.second}
      viewBox={`0 0 ${String(CHART.width)} ${String(CHART.height)}`}
      width="100%"
      className="block cursor-crosshair"
      role="img"
      aria-label={t.pvpReplayChartLabel}
      onMouseMove={onMouseMove}
      onMouseLeave={() => {
        onHover(null);
      }}
    >
      <g className="text-line" stroke="currentColor" strokeWidth={1} strokeDasharray={DASH}>
        {hairlines.map((fraction) => (
          <line key={fraction} x1={CHART.left} x2={CHART.width - CHART.right} y1={yOf(fraction)} y2={yOf(fraction)} />
        ))}
      </g>
      <g className="fill-current font-mono text-[10px] text-muted">
        {hairlines.map((fraction) => (
          <text key={fraction} x={CHART.left - 4} y={yOf(fraction) + 3} textAnchor="end">
            {formatCompactNumber(axisMax * fraction, lang, 0)}
          </text>
        ))}
        {ticks.map((second, index) => (
          <text
            key={second}
            x={xOf(second, seconds)}
            y={CHART.height - 6}
            textAnchor={index === 0 ? 'start' : index === ticks.length - 1 ? 'end' : 'middle'}
          >
            {sub(t.pvpReplayAxisSeconds, { s: formatCount(second, locale) })}
          </text>
        ))}
      </g>
      <g fill="none" strokeWidth={1.5} strokeLinejoin="round">
        <polyline className="text-muted" stroke="currentColor" strokeDasharray={DASH} points={roomHp} data-series="room-hp" />
        <polyline className="text-down" stroke="currentColor" points={defender} data-series="defender" />
        <polyline className="text-up" stroke="currentColor" points={attacker} data-series="attacker" />
      </g>
      {last === undefined ? null : (
        <g fill="currentColor">
          <circle className="text-muted" cx={xOf(last.second, seconds)} cy={yOf(last.roomHp)} r={END_DOT_RADIUS} />
          <circle className="text-down" cx={xOf(last.second, seconds)} cy={yOf(last.defenderDamage / axisMax)} r={END_DOT_RADIUS} />
          <circle className="text-up" cx={xOf(last.second, seconds)} cy={yOf(last.attackerDamage / axisMax)} r={END_DOT_RADIUS} />
        </g>
      )}
      {hovered === null ? null : (
        <g data-testid="pvp-replay-cursor" pointerEvents="none">
          <line
            className="text-ink"
            stroke="currentColor"
            strokeWidth={1}
            x1={xOf(hovered.second, seconds)}
            x2={xOf(hovered.second, seconds)}
            y1={CHART.top - 2}
            y2={CHART.top + PLOT_HEIGHT}
          />
          <text
            className="fill-current font-mono text-[10px] text-ink"
            x={xOf(hovered.second, seconds)}
            y={CHART.top - 4}
            textAnchor={cursorLabelAnchor(hovered.second, seconds)}
          >
            {sub(t.pvpReplayAxisSeconds, { s: formatCount(hovered.second, locale) })}
          </text>
          <g fill="currentColor" stroke="var(--surface)" strokeWidth={1.5}>
            <circle className="text-muted" cx={xOf(hovered.second, seconds)} cy={yOf(hovered.roomHp)} r={CURSOR_DOT_RADIUS} />
            <circle className="text-down" cx={xOf(hovered.second, seconds)} cy={yOf(hovered.defenderDamage / axisMax)} r={CURSOR_DOT_RADIUS} />
            <circle className="text-up" cx={xOf(hovered.second, seconds)} cy={yOf(hovered.attackerDamage / axisMax)} r={CURSOR_DOT_RADIUS} />
          </g>
        </g>
      )}
    </svg>
  );
}

function cursorLabelAnchor(second: number, seconds: number): 'start' | 'middle' | 'end' {
  if (second < seconds * 0.1) return 'start';
  if (second > seconds * 0.9) return 'end';
  return 'middle';
}

/** The close sits in the panel's own corner, over its padding, the way a dialog's does. */
function CloseCorner({ label, onClose }: { label: string; onClose: () => void }) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger
        render={
          <Button
            type="button"
            variant="icon"
            aria-label={label}
            data-testid="pvp-replay-close"
            onClick={onClose}
            className={cn('absolute', 'top-1.5', 'right-1.5', 'z-10')}
          >
            <Icon name="x-mark" size="sm" />
          </Button>
        }
      />
      <Tooltip.Portal>
        <Tooltip.Positioner sideOffset={6}>
          <Tooltip.Popup>{label}</Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

function LegendEntry({ tone, dashed = false, children, testId }: { tone: string; dashed?: boolean; children: string; testId: string }) {
  return (
    <span className={cn('inline-flex', 'items-center', 'gap-1.5', tone)} data-testid={testId}>
      <svg width="14" height="4" viewBox="0 0 14 4" aria-hidden="true" className="shrink-0">
        <line x1={0} x2={14} y1={2} y2={2} stroke="currentColor" strokeWidth={2} {...(dashed ? { strokeDasharray: DASH } : {})} />
      </svg>
      {children}
    </span>
  );
}

function ReplayFacts({ view, t, locale }: { view: PvpFilmView; t: Copy; locale: AppLocale }) {
  const { facts } = view;
  const widest = facts.widestLead;
  return (
    <div className="flex flex-wrap gap-2" data-testid="pvp-replay-facts">
      <FactTile
        label={t.pvpReplayLeadTaken}
        data-testid="pvp-replay-lead-taken"
        value={
          facts.leadTakenAtSecond === null
            ? t.pvpReplayLeadTakenNever
            : sub(t.pvpReplayLeadTakenAt, { s: formatCount(facts.leadTakenAtSecond, locale) })
        }
      />
      <FactTile
        label={t.pvpReplayWidestLead}
        data-testid="pvp-replay-widest-lead"
        valueClassName={widest === null ? 'text-muted' : widest.amount > 0 ? 'text-up' : 'text-down'}
        value={
          widest === null ? (
            EM_DASH
          ) : (
            <>
              {formatSigned(widest.amount, locale)}{' '}
              <span className="text-xs font-normal text-muted">
                {sub(t.pvpReplayWidestLeadAt, { s: formatCount(widest.atSecond, locale) })}
              </span>
            </>
          )
        }
      />
      <FactTile label={t.pvpReplayRoomHp} data-testid="pvp-replay-room-hp" value={formatPercent(facts.roomHpLeft, locale)} />
      <FactTile
        label={t.pvpReplayBombs}
        data-testid="pvp-replay-bombs"
        value={sub(t.pvpReplayBombsValue, { a: formatCount(facts.bombs.attacker, locale), d: formatCount(facts.bombs.defender, locale) })}
      />
    </div>
  );
}

/**
 * One kept film, read into a per-second damage chart and the facts its frames settle. The film
 * is fetched when the player opens it and forgotten when they close it; the row beside it names
 * the opponent, since the film carries no names of its own.
 */
export function ReplayPanel({
  filmId,
  row,
  onClose,
  className,
}: {
  filmId: number | null;
  row: PvpDuelRow | null;
  onClose: () => void;
  className?: string;
}) {
  const t = useCopy();
  const { locale, lang } = useLocale();
  const film = usePvpFilm(filmId);
  const [hoveredSecond, setHoveredSecond] = useState<number | null>(null);
  if (filmId === null) return null;

  const view = film.status === 'ready' ? film.view : null;
  const opponent = row?.defender.name ?? EM_DASH;
  const last = view?.series[view.series.length - 1];
  const hovered = view === null || hoveredSecond === null ? null : (view.series[hoveredSecond] ?? null);
  const shown = hovered ?? last;

  return (
    <Panel data-testid="pvp-replay" data-state={film.status} data-film-id={filmId} className={cn('relative', className)}>
      <CloseCorner label={t.pvpReplayClose} onClose={onClose} />
      <PanelHeader title={t.pvpReplayTitle} className="pr-8">
        {view === null ? null : (
          <span className="text-xs text-muted" data-testid="pvp-replay-note">
            {sub(t.pvpReplayNote, {
              opponent,
              id: String(view.filmId),
              frames: formatCount(view.facts.frames, locale),
              hz: formatCount(view.facts.hz, locale),
            })}
          </span>
        )}
      </PanelHeader>
      {film.status === 'missing' ? (
        <p className="m-0 text-xs text-muted">{t.pvpReplayMissing}</p>
      ) : view === null ? (
        <p className="m-0 text-xs text-muted">{t.pvpReplayLoading}</p>
      ) : (
        <div className="flex flex-col gap-3">
          <ReplayFacts view={view} t={t} locale={locale} />
          <ReplayChart view={view} t={t} locale={locale} lang={lang} hovered={hovered} onHover={setHoveredSecond} />
          <div
            className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs tabular-nums"
            data-testid="pvp-replay-legend"
            data-at-second={hovered === null ? undefined : hovered.second}
          >
            {hovered === null ? null : (
              <span className="font-mono text-ink" data-testid="pvp-replay-legend-at">
                {sub(t.pvpReplayLegendAt, { s: formatCount(hovered.second, locale) })}
              </span>
            )}
            <LegendEntry tone="text-up" testId="pvp-replay-legend-you">
              {sub(t.pvpReplayLegendYou, { total: formatCount(shown?.attackerDamage ?? 0, locale) })}
            </LegendEntry>
            <LegendEntry tone="text-down" testId="pvp-replay-legend-opponent">
              {sub(t.pvpReplayLegendOpponent, { opponent, total: formatCount(shown?.defenderDamage ?? 0, locale) })}
            </LegendEntry>
            <LegendEntry tone="text-muted" dashed testId="pvp-replay-legend-room-hp">
              {sub(t.pvpReplayLegendRoomHp, { pct: formatPercent(shown?.roomHp ?? 0, locale) })}
            </LegendEntry>
          </div>
        </div>
      )}
    </Panel>
  );
}

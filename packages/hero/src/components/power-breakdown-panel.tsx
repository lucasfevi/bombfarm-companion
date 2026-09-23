'use client';

import { useId, useMemo, useState } from 'react';
import {
  gamePower,
  gamePowerInputOf,
  gamePowerInputWithoutRunes,
  type GamePowerAxis,
  type GamePowerInput,
} from '@bombfarm/domain/game-power';
import type { SheetStats } from '@bombfarm/domain/gear';
import type { SheetKey } from '@bombfarm/domain/planner-constants';
import { hasRuneOnSheet, runesOf } from '@bombfarm/domain/runes';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';
import { InfoTip, Panel, Tooltip, cn, formatCompactNumber, panelHClass, panelTitleClass, tipClass } from '@bombfarm/ui';
import { heroCopyFor, sub, type HeroCopy, type Lang } from '../copy';
import {
  POWER_ROW_AXES,
  formatMultiplier,
  formatPowerFigure,
  formatShare,
  formatSignedPct,
  powerFactorRows,
  powerMismatchPct,
  type PowerFactorRow,
  type PowerRowId,
} from '../model/power-breakdown';
import { PowerFactorChart } from './power-factor-chart';

const ROW_LABEL_KEY: Record<PowerRowId, keyof HeroCopy> = {
  crit: 'heroDetailPowerFactorCrit',
  speed: 'heroDetailPowerFactorSpeed',
  range: 'heroDetailPowerFactorRange',
  utility: 'heroDetailPowerFactorUtility',
  energy: 'heroDetailPowerFactorEnergy',
  penetration: 'heroDetailPowerFactorPenetration',
  cooldown: 'heroDetailPowerFactorCooldown',
  attack: 'heroDetailPowerFactorAttack',
};

const SWATCH_CLASS: Record<PowerRowId, string> = {
  crit: 'bg-down',
  speed: 'bg-info',
  range: 'bg-gold',
  utility: 'bg-up',
  energy: 'bg-rar-3',
  penetration: 'bg-accent',
  cooldown: 'bg-rar-0',
  attack: 'bg-ink',
};

const focusRingClass =
  'focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

type StatLabel = (key: SheetKey) => string;

type PowerHero = Pick<HeroRecord, 'abilities' | 'runes' | 'power'>;

function rowLabel(id: PowerRowId, t: HeroCopy): string {
  return t[ROW_LABEL_KEY[id]];
}

function axisLabelFor(axis: GamePowerAxis, t: HeroCopy, statLabel: StatLabel): string {
  return axis === 'explosaoAmpla' ? t.heroDetailPowerAxisAmpla : statLabel(axis);
}

function ShareBar({
  rows,
  selected,
  onSelect,
  t,
  lang,
}: {
  rows: readonly PowerFactorRow[];
  selected: PowerRowId | null;
  onSelect: (id: PowerRowId) => void;
  t: HeroCopy;
  lang: Lang;
}) {
  return (
    <div role="group" aria-label={t.heroDetailPowerShareBar} className="flex h-3 w-full overflow-hidden rounded-sm bg-bg-2">
      {rows.map((row) =>
        row.share !== null && row.share > 0 ? (
          <button
            key={row.id}
            type="button"
            tabIndex={-1}
            aria-label={sub(t.heroDetailPowerSegment, { factor: rowLabel(row.id, t), share: formatShare(row.share, lang) })}
            data-power-segment={row.id}
            data-selected={selected === row.id ? 'true' : undefined}
            onClick={() => onSelect(row.id)}
            className={cn(
              'h-full cursor-pointer border-0 p-0 transition-opacity',
              SWATCH_CLASS[row.id],
              selected !== null && selected !== row.id ? 'opacity-30' : null,
            )}
            style={{ width: `${String(row.share * 100)}%` }}
          />
        ) : null,
      )}
    </div>
  );
}

function FactorRow({
  row,
  input,
  selected,
  chartId,
  onSelect,
  t,
  lang,
}: {
  row: PowerFactorRow;
  input: GamePowerInput;
  selected: boolean;
  chartId: string;
  onSelect: (id: PowerRowId) => void;
  t: HeroCopy;
  lang: Lang;
}) {
  return (
    <li>
      <button
        type="button"
        aria-pressed={selected}
        aria-controls={selected ? chartId : undefined}
        data-power-row={row.id}
        onClick={() => onSelect(row.id)}
        className={cn(
          'grid w-full cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto_3.5rem] items-center gap-2.5 rounded-sm border px-2 py-1.5 text-left text-ink',
          selected ? 'border-accent bg-bg-2' : 'border-transparent bg-transparent hover:bg-bg-2',
          focusRingClass,
        )}
      >
        <span aria-hidden="true" className={cn('size-2.5 rounded-sm', SWATCH_CLASS[row.id])} />
        <span className="truncate text-xs">{rowLabel(row.id, t)}</span>
        <span className="font-mono text-xs tabular-nums">
          {row.multiplier === null ? formatCompactNumber(input.sheet.attack, lang, 1) : formatMultiplier(row.multiplier, lang)}
        </span>
        <span className="text-right font-mono text-xs text-muted tabular-nums">
          {row.share === null ? t.heroDetailPowerAnchor : formatShare(row.share, lang)}
        </span>
      </button>
    </li>
  );
}

function PowerHeading({ total, t }: { total: string; t: HeroCopy }) {
  return (
    <div className={panelHClass}>
      <span className="flex items-center gap-1.5">
        <h2 className={panelTitleClass}>{t.heroDetailPowerTitle}</h2>
        <InfoTip label={t.heroDetailPowerTitle} tip={t.heroDetailPowerTip} />
      </span>
      <span className="font-mono text-base font-bold text-gold tabular-nums" data-testid="power-total">
        {total}
      </span>
    </div>
  );
}

function PowerBreakdown({
  hero,
  sheet,
  treeCritDmgPct,
  lang,
  statLabel,
  t,
}: {
  hero: PowerHero;
  sheet: SheetStats;
  treeCritDmgPct: number;
  lang: Lang;
  statLabel: StatLabel;
  t: HeroCopy;
}) {
  const chartId = useId();
  const [selected, setSelected] = useState<PowerRowId | null>(null);
  const input = useMemo(() => gamePowerInputOf(sheet, hero.abilities), [sheet, hero.abilities]);
  const rows = useMemo(() => powerFactorRows(input), [input]);
  const total = useMemo(() => gamePower(input), [input]);
  const computedRuneFree = useMemo(
    () => gamePower(gamePowerInputWithoutRunes(input, runesOf(hero), treeCritDmgPct)),
    [hero, input, treeCritDmgPct],
  );
  const runeFree = hasRuneOnSheet(runesOf(hero)) ? (hero.power ?? computedRuneFree) : null;
  const mismatchPct = powerMismatchPct(computedRuneFree, hero.power);
  const onSelect = (id: PowerRowId) => setSelected((current) => (current === id ? null : id));

  return (
    <>
      <PowerHeading total={formatPowerFigure(total, lang)} t={t} />
      {runeFree !== null ? (
        <p className={cn(tipClass, 'text-right')} data-testid="power-rune-note">
          {sub(t.heroDetailPowerRunesActive, { value: formatPowerFigure(runeFree, lang) })}
        </p>
      ) : null}
      {mismatchPct !== null ? (
        <p className={cn(tipClass, 'text-right text-warn')} data-testid="power-mismatch-note">
          {sub(t.heroDetailPowerDiffers, { pct: formatSignedPct(mismatchPct, lang) })}
        </p>
      ) : null}
      <ShareBar rows={rows} selected={selected} onSelect={onSelect} t={t} lang={lang} />
      <div className="mt-3 grid grid-cols-1 gap-4 @min-[46rem]:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
          {rows.map((row) => (
            <FactorRow
              key={row.id}
              row={row}
              input={input}
              selected={selected === row.id}
              chartId={chartId}
              onSelect={onSelect}
              t={t}
              lang={lang}
            />
          ))}
        </ul>
        <div id={chartId} className="flex min-w-0 flex-col gap-4" data-testid="power-chart-region">
          {selected === null ? (
            <p className={tipClass}>{t.heroDetailPowerPick}</p>
          ) : (
            POWER_ROW_AXES[selected].map((axis) => (
              <PowerFactorChart
                key={axis}
                input={input}
                axis={axis}
                axisLabel={axisLabelFor(axis, t, statLabel)}
                t={t}
                lang={lang}
              />
            ))
          )}
        </div>
      </div>
    </>
  );
}

/**
 * The game's own Power figure, taken apart into the factors that multiply it.
 *
 * `sheet` is the hero's sheet as the game shows it — composed with points and runes, before any
 * team aura — so the total reads the same as the game's own screen; the rune-free figure the
 * account read stores is named beside it while a rune is on. A hero whose spent points could not
 * be read has no such sheet (`null`): the panel then prints the stored figure alone and says why,
 * rather than a breakdown built on zero points.
 */
export function PowerBreakdownPanel({
  hero,
  sheet,
  treeCritDmgPct,
  lang,
  statLabel,
}: {
  hero: PowerHero;
  sheet: SheetStats | null;
  /** The skill tree's flat crit-damage add, planner percentage points — where the rune model puts crit damage's rune. */
  treeCritDmgPct: number;
  lang: Lang;
  statLabel: StatLabel;
}) {
  const t = heroCopyFor(lang);
  return (
    <Panel className="@container min-w-0" data-testid="power-breakdown">
      <Tooltip.Provider delay={200} closeDelay={100}>
        {sheet === null ? (
          <>
            <PowerHeading total={hero.power == null ? '—' : formatPowerFigure(hero.power, lang)} t={t} />
            <p className={tipClass} data-testid="power-withheld">
              {t.heroDetailPowerWithheld}
            </p>
          </>
        ) : (
          <PowerBreakdown
            hero={hero}
            sheet={sheet}
            treeCritDmgPct={treeCritDmgPct}
            lang={lang}
            statLabel={statLabel}
            t={t}
          />
        )}
      </Tooltip.Provider>
    </Panel>
  );
}

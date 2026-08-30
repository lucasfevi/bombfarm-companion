import type { ReactNode } from 'react';
import { HeroAvatar, rarityTextClass } from '@bombfarm/game-art';
import { sub, useCopy, useLocale, type Copy } from '../../lib/copy';
import { formatEnergyPercent } from '../../lib/format';
import type { LiveHeroFact } from '../../lib/live/live-model';
import { EnergyBar } from './energy-bar';

export type LiveRotationRowState = 'on-field' | 'recovering' | 'queued' | 'benched';

/** `ArtFrame`'s own middle-of-the-road default — tints the avatar frame when the roster join has
 *  not caught up to this hero's rarity yet. */
const NEUTRAL_RARITY_IDX = 2;

/**
 * One literal per state rather than a computed class name: the shell's untranslated-prose guard
 * only tolerates a Tailwind string written directly as `className="…"`, so a class built from an
 * interpolated or looked-up token is reported as player-facing text.
 */
function RowStateDot({ state }: { state: LiveRotationRowState }) {
  if (state === 'on-field') return <span aria-hidden className="size-2 shrink-0 rounded-full bg-up" />;
  if (state === 'recovering') return <span aria-hidden className="size-2 shrink-0 rounded-full bg-info" />;
  if (state === 'queued') return <span aria-hidden className="size-2 shrink-0 rounded-full bg-warn" />;
  return <span aria-hidden className="size-2 shrink-0 rounded-full bg-muted" />;
}

/** The dot above is colour-only; this is what actually reaches a screen reader on every row —
 *  the summary bar above the list is the legend, but the state must still announce per row. */
function rowStateLabel(state: LiveRotationRowState, t: Copy): string {
  if (state === 'on-field') return t.liveListOnFieldTitle;
  if (state === 'recovering') return t.liveListRecoveringTitle;
  if (state === 'queued') return t.liveListQueuedTitle;
  return t.liveListBenchedTitle;
}

/** The energy reading beside the bar — its own fixed grid column (see `HeroRow`) rather than part
 *  of `EnergyBar`, so this column's width never depends on whether the row also has a countdown. */
function EnergyReading({ testId, fraction }: { testId: string; fraction: number | undefined }) {
  const t = useCopy();
  const { locale } = useLocale();
  const known = fraction !== undefined;

  return (
    <span data-testid={testId} className="block text-right text-[10px] leading-none tabular-nums text-muted">
      {known ? formatEnergyPercent(fraction, locale) : t.fidelityStatusMissing}
    </span>
  );
}

export function HeroRow({
  state,
  hero,
  muted = false,
  trailing,
}: {
  state: LiveRotationRowState;
  hero: LiveHeroFact;
  /** Drains the row's colour — a hero who is out of the rotation entirely, not resting inside it. */
  muted?: boolean;
  trailing?: ReactNode;
}) {
  const t = useCopy();
  // Name and grade arrive from the same roster join, so a grade without a name is half a join —
  // rendering it would put a rank letter beside a bare id as though both were known.
  const rank = hero.name !== undefined ? hero.grade?.trim() : undefined;
  const name = hero.name ?? hero.id;
  const nameColorClass = hero.rarity !== undefined ? (rarityTextClass(hero.rarity) ?? 'text-ink') : 'text-ink';
  const energyTestId = `live-energy-${hero.id}`;

  return (
    <li
      data-testid={`live-hero-row-${hero.id}`}
      data-muted={muted ? '' : undefined}
      className="grid grid-cols-[0.5rem_8rem_minmax(0,1fr)_2.25rem_4rem] items-center gap-2 rounded-sm border border-line bg-[color-mix(in_oklch,var(--surface)_92%,transparent)] px-2 py-1 data-[muted]:opacity-60 data-[muted]:grayscale"
    >
      <span className="flex items-center">
        <RowStateDot state={state} />
        <span className="sr-only">{rowStateLabel(state, t)}</span>
      </span>
      <span className="flex min-w-0 items-center gap-2">
        <HeroAvatar skin={hero.skin ?? 0} rarityIdx={hero.rarity ?? NEUTRAL_RARITY_IDX} size="xs" name={name} />
        <span className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
          <span className="flex min-w-0 items-baseline gap-1">
            {rank ? (
              <span className="shrink-0 text-[11px] leading-none font-black tracking-tight text-accent">{rank}</span>
            ) : (
              <span className="shrink-0 text-[11px] leading-none font-black tracking-tight text-muted">—</span>
            )}
            <span className="min-w-0 flex-1 truncate text-[12px] leading-none font-bold">
              <span data-testid={`live-hero-row-${hero.id}-name`} className={nameColorClass}>
                {name}
              </span>
            </span>
          </span>
          <span className="text-[10px] leading-none text-muted tabular-nums">
            {sub(t.liveHeroLevelValue, { level: hero.level ?? 0 })}
          </span>
        </span>
      </span>
      <EnergyBar testId={energyTestId} fraction={hero.energyFraction} />
      <EnergyReading testId={`${energyTestId}-value`} fraction={hero.energyFraction} />
      {trailing !== undefined ? <span className="flex items-center gap-1">{trailing}</span> : null}
    </li>
  );
}

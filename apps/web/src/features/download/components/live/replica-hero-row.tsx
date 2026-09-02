import { heroLevelLabel } from '@bombfarm/domain/game-labels';
import { HeroAvatar } from '@/shared/game-art';
import type { Lang } from '@/shared/i18n';
import { liveLabel, type MirroredKey } from '../../model/live-replica-copy';
import type { ReplicaDensity, ReplicaHero, ReplicaRowState } from '../../model/live-replica-data';

const STATE_DOT_CLASS: Record<ReplicaRowState, string> = {
  'on-field': 'bg-up',
  recovering: 'bg-warn',
  queued: 'bg-muted',
  benched: 'bg-line',
};

/**
 * The compact row's state marker is a shape as well as a colour, the way the desktop's second
 * window draws it: at that width the summary bar that acts as the legend scrolls out of view, and
 * four dots differing only in colour leave the reader nothing to tell them apart.
 */
const STATE_MARK_CLASS: Record<ReplicaRowState, string> = {
  'on-field': 'size-2 shrink-0 rounded-full bg-up',
  recovering: 'size-2 shrink-0 rounded-full border-2 border-info bg-transparent',
  queued: 'size-2 shrink-0 rounded-[1px] bg-warn',
  benched: 'h-0.5 w-2 shrink-0 rounded-full bg-muted',
};

const STATE_LABEL_KEY: Record<ReplicaRowState, MirroredKey> = {
  'on-field': 'liveListOnFieldTitle',
  recovering: 'liveListRecoveringTitle',
  queued: 'liveListQueuedTitle',
  benched: 'liveListBenchedTitle',
};

/**
 * The caret in front of the energy reading, drawn from the row's state the same way the desktop
 * row derives it: a hero on the field is spending energy, a resting one is recovering it, and
 * every other state holds still and gets no marker.
 *
 * Like the desktop's, it is held in place by the mono figure beside it in a fixed slot rather
 * than by anything of its own — the slot is what stops a reading gaining a digit and dragging the
 * caret with it, which no choice of face can do.
 */
const ENERGY_DIRECTION: Record<ReplicaRowState, { readonly glyph: string; readonly className: string } | null> = {
  'on-field': { glyph: '▾', className: 'text-down' },
  recovering: { glyph: '▴', className: 'text-up' },
  queued: null,
  benched: null,
};

const RARITY_TEXT_CLASS: Record<number, string> = {
  0: 'text-rar-0',
  1: 'text-rar-1',
  2: 'text-rar-2',
  3: 'text-rar-3',
  4: 'text-rar-4',
  5: 'text-rar-5',
};

/**
 * The column track mirrors the desktop row — state dot, identity, energy track, reading,
 * countdown — with the identity column allowed to shrink so the whole drawing fits its container
 * instead of scrolling sideways. Its energy bar is hand-rolled for the same reason the desktop's
 * is: the design system's `Bar` is sized for the planner's ranking cards and reads too heavy on a
 * single inline line.
 *
 * The compact density is the second Live window's row: two lines at a fixed height, so a row is
 * the same height whichever state it is in. Rank and name lead the first line with the countdown
 * at its end; the state marker, level, energy reading and bar share the second. The reading sits
 * at the head of the bar it describes rather than at the row's edge, where it drifted away from
 * its own hero as the window widened, and both it and the level hold fixed slots so every row
 * puts them in the same place.
 */
export function ReplicaHeroRow({
  hero,
  lang,
  density = 'full',
}: {
  hero: ReplicaHero;
  lang: Lang;
  density?: ReplicaDensity;
}) {
  const muted = hero.state === 'benched';
  const direction = ENERGY_DIRECTION[hero.state];
  const rarityClass = RARITY_TEXT_CLASS[hero.rarity] ?? 'text-ink';
  const energyFill = (
    <span
      className="block h-full rounded-full bg-[color-mix(in_oklch,var(--accent)_55%,var(--bg-2))]"
      style={{ width: `${String(hero.energyPercent)}%` }}
    />
  );

  if (density === 'compact') {
    return (
      <li className="grid h-9 grid-cols-[1.75rem_minmax(0,1fr)] grid-rows-2 items-center gap-x-1.5 rounded-sm px-1 odd:bg-[color-mix(in_oklch,var(--ink)_5%,transparent)]">
        <span className="row-span-2">
          <HeroAvatar skin={hero.skin} rarityIdx={hero.rarity} size="xs" name={hero.name} />
        </span>
        <span className="flex min-w-0 items-baseline gap-1.5">
          <span className="min-w-3 shrink-0 text-[10px] leading-none font-bold text-accent">
            {hero.grade}
          </span>
          <span className={`min-w-0 flex-1 truncate text-[11px] leading-none ${rarityClass}`}>
            {hero.name}
          </span>
          <span className="shrink-0 font-mono text-[10px] leading-none text-ink tabular-nums">
            {hero.countdown ?? ''}
          </span>
        </span>
        <span className="flex min-w-0 items-center gap-1.5">
          <span aria-hidden="true" className={STATE_MARK_CLASS[hero.state]} />
          <span className="sr-only">{liveLabel(STATE_LABEL_KEY[hero.state], lang)}</span>
          <span className="w-10 shrink-0 font-mono text-[10px] leading-none text-muted tabular-nums">
            {heroLevelLabel(hero.level, lang)}
          </span>
          <span className="w-8 shrink-0 text-right font-mono text-[10px] leading-none text-ink tabular-nums">
            {hero.energyPercent}%
          </span>
          <span className="block h-1 min-w-8 flex-1 overflow-hidden rounded-full bg-bg">
            {energyFill}
          </span>
        </span>
      </li>
    );
  }

  return (
    <li
      data-muted={muted ? '' : undefined}
      className="grid grid-cols-[0.5rem_minmax(5.5rem,9rem)_minmax(0,1fr)_3.25rem_3.25rem] items-center gap-2 rounded-sm border border-line bg-[color-mix(in_oklch,var(--surface)_92%,transparent)] px-2 py-1 odd:bg-[color-mix(in_oklch,var(--ink)_5%,var(--surface))] data-[muted]:opacity-60 data-[muted]:grayscale"
    >
      <span className={`size-2 rounded-full ${STATE_DOT_CLASS[hero.state]}`} />
      <span className="flex min-w-0 items-center gap-2">
        <HeroAvatar skin={hero.skin} rarityIdx={hero.rarity} size="xs" name={hero.name} />
        <span className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
          <span className="flex min-w-0 items-baseline gap-1">
            <span className="shrink-0 text-[11px] leading-none font-black tracking-tight text-accent">
              {hero.grade}
            </span>
            <span className={`min-w-0 flex-1 truncate text-xs leading-none font-bold ${rarityClass}`}>
              {hero.name}
            </span>
          </span>
          <span className="text-[10px] leading-none text-muted tabular-nums">Lv {hero.level}</span>
        </span>
      </span>
      <span className="h-1 min-w-0 overflow-hidden rounded-full bg-bg">{energyFill}</span>
      <span className="flex items-center justify-end gap-1 text-[10px] leading-none text-muted">
        {direction !== null ? (
          <span className={`text-[13px] leading-none ${direction.className}`}>{direction.glyph}</span>
        ) : null}
        <span className="inline-block w-[4ch] text-right font-mono">{hero.energyPercent}%</span>
      </span>
      <span className="text-right font-mono text-[11px] text-ink tabular-nums">
        {hero.countdown ?? ''}
      </span>
    </li>
  );
}

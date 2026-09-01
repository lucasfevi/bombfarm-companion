import { HeroAvatar } from '@/shared/game-art';
import type { ReplicaHero, ReplicaRowState } from '../../model/live-replica-data';

const STATE_DOT_CLASS: Record<ReplicaRowState, string> = {
  'on-field': 'bg-up',
  recovering: 'bg-warn',
  queued: 'bg-muted',
  benched: 'bg-line',
};

/**
 * The caret in front of the energy reading, drawn from the row's state the same way the desktop
 * row derives it: a hero on the field is spending energy, a resting one is recovering it, and
 * every other state holds still and gets no marker.
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
 */
export function ReplicaHeroRow({ hero }: { hero: ReplicaHero }) {
  const muted = hero.state === 'benched';
  const direction = ENERGY_DIRECTION[hero.state];

  return (
    <li
      data-muted={muted ? '' : undefined}
      className="grid grid-cols-[0.5rem_minmax(5.5rem,9rem)_minmax(0,1fr)_3.25rem_3.25rem] items-center gap-2 rounded-sm border border-line bg-[color-mix(in_oklch,var(--surface)_92%,transparent)] px-2 py-1 data-[muted]:opacity-60 data-[muted]:grayscale"
    >
      <span className={`size-2 rounded-full ${STATE_DOT_CLASS[hero.state]}`} />
      <span className="flex min-w-0 items-center gap-2">
        <HeroAvatar skin={hero.skin} rarityIdx={hero.rarity} size="xs" name={hero.name} />
        <span className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
          <span className="flex min-w-0 items-baseline gap-1">
            <span className="shrink-0 text-[11px] leading-none font-black tracking-tight text-accent">
              {hero.grade}
            </span>
            <span
              className={`min-w-0 flex-1 truncate text-xs leading-none font-bold ${RARITY_TEXT_CLASS[hero.rarity] ?? 'text-ink'}`}
            >
              {hero.name}
            </span>
          </span>
          <span className="text-[10px] leading-none text-muted tabular-nums">Lv {hero.level}</span>
        </span>
      </span>
      <span className="h-1 min-w-0 overflow-hidden rounded-full bg-bg">
        <span
          className="block h-full rounded-full bg-[color-mix(in_oklch,var(--accent)_55%,var(--bg-2))]"
          style={{ width: `${String(hero.energyPercent)}%` }}
        />
      </span>
      <span className="flex items-center justify-end gap-0.5 text-[10px] leading-none text-muted tabular-nums">
        {direction !== null ? <span className={direction.className}>{direction.glyph}</span> : null}
        <span>{hero.energyPercent}%</span>
      </span>
      <span className="text-right font-mono text-[11px] text-ink tabular-nums">
        {hero.countdown ?? ''}
      </span>
    </li>
  );
}

'use client';

import { RARITIES } from '@bombfarm/domain/planner-constants';
import { rarityLabel } from '@bombfarm/domain/game-labels';
import type { Lang } from '@bombfarm/domain/shims/i18n';
import { cn } from '@bombfarm/ui';
import { HeroAvatar } from './hero-avatar';
import { rarityTextClass } from './game-art.recipe';
import type { ArtFrameSize } from './art-frame';

/** `ArtFrame`'s own middle-of-the-road default (Raro) — tints the frame when there is no rarity
 *  yet to show, e.g. a roster join that has not caught up to this hero. */
const NEUTRAL_RARITY_IDX = 2;

export type HeroIdentityVariant = 'inline' | 'stacked';

/** Avatar + rank/name/rarity/level·id block, built from primitives rather than a `HeroRecord` so
 *  a caller with a partially-known hero (a live roster join, mid-flight) can render it too. */
export function HeroIdentity({
  name,
  rank,
  rarityIdx,
  stars = 0,
  level,
  skin = 0,
  shortId,
  lang,
  size = 'sm',
  variant = 'inline',
  nameTestId,
}: {
  name: string;
  rank?: string;
  rarityIdx?: number;
  stars?: number;
  level?: number;
  skin?: number;
  /** Trailing `#<id>`, shown only in `inline` — `stacked` drops it for a uniform line count. */
  shortId?: string;
  lang: Lang;
  size?: ArtFrameSize;
  /**
   * `stacked` pins the block to three lines (rank+name / rarity / level) and drops the record
   * id, so a grid of chips keeps one uniform height regardless of name or rarity length.
   */
  variant?: HeroIdentityVariant;
  /** `data-testid` on the element carrying the hero's own name, for a caller that needs one. */
  nameTestId?: string;
}) {
  const hasRarity = rarityIdx !== undefined;
  const clampedStars = Math.max(0, Math.min(3, Math.round(stars)));
  const stacked = variant === 'stacked';

  const rarity = (
    <span
      className={cn(
        'truncate font-bold',
        hasRarity ? (rarityTextClass(rarityIdx) ?? 'text-muted') : 'invisible',
      )}
      aria-hidden={hasRarity ? undefined : true}
    >
      {hasRarity ? rarityLabel(RARITIES[rarityIdx], lang) : '—'}
    </span>
  );

  return (
    <div className="flex min-w-0 items-center gap-2">
      <div className="shrink-0">
        <HeroAvatar skin={skin} rarityIdx={rarityIdx ?? NEUTRAL_RARITY_IDX} size={size} name={name} />
      </div>
      <div className="min-w-0 text-left">
        <div
          className={cn(
            'flex min-w-0 items-baseline gap-x-1.5',
            stacked ? 'flex-nowrap' : 'flex-wrap gap-y-0.5',
          )}
        >
          <span
            className={cn(
              'shrink-0 text-[13px] leading-none font-black tracking-tight',
              rank?.trim() ? 'text-accent' : 'text-muted',
            )}
          >
            {rank?.trim() || '—'}
          </span>
          <span data-testid={nameTestId} className="truncate text-[13px] leading-none font-bold text-ink">
            {name}
          </span>
          {clampedStars > 0 ? (
            <span className="shrink-0 text-[10px] leading-none tracking-tight text-rar-4" aria-hidden>
              {'★'.repeat(clampedStars)}
            </span>
          ) : null}
        </div>
        {stacked ? (
          <>
            <div className="mt-1 flex min-w-0 text-[10px] leading-none">{rarity}</div>
            <div
              className={cn('mt-1 text-[10px] leading-none text-muted', level === undefined && 'invisible')}
              aria-hidden={level === undefined ? true : undefined}
            >
              Lv {level ?? 0}
            </div>
          </>
        ) : (
          <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] leading-none">
            {rarity}
            <span className="shrink-0 text-muted">
              Lv {level}
              <span aria-hidden> · </span>#{shortId}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

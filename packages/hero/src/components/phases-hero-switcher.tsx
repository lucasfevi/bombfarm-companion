'use client';

import { useState, type ReactNode } from 'react';
import { HeroAvatar, rarityTextClass } from '@bombfarm/game-art';
import { cn, Icon, Tooltip } from '@bombfarm/ui';
import { rarityLabel } from '@bombfarm/domain/game-labels';
import { RARITIES } from '@bombfarm/domain/planner-constants';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';
import { MAX_STARS } from '@bombfarm/domain/gear';
import type { Lang, RosterCopy } from '../copy';

/** What a host's picker needs to open over this control and report a pick back to it. */
export type HeroPickerSlotProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  heroes: HeroRecord[];
  heroId: string;
  formatNumber: (n: number, d?: number) => string;
  onSelectHero: (hero: HeroRecord) => void;
};

export type HeroPickerSlot = (picker: HeroPickerSlotProps) => ReactNode;

type Props = {
  t: RosterCopy;
  lang: Lang;
  heroes: HeroRecord[];
  hero: HeroRecord;
  formatNumber: (n: number, d?: number) => string;
  onSelectHero: (h: HeroRecord) => void;
  renderPicker?: HeroPickerSlot | undefined;
};

/**
 * Compact identity control for the hero the panels below describe.
 *
 * With `renderPicker` it opens that host's Switch Hero dialog; without one it is a static identity
 * block — no button, no switch affordance, no accessible name promising a control. A host whose
 * roster is read-only gets the identity it can show rather than a control that does nothing when
 * pressed.
 */
export function PhasesHeroSwitcherView({
  t,
  lang,
  heroes,
  hero,
  formatNumber,
  onSelectHero,
  renderPicker,
}: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const rarityIndex = RARITIES.indexOf(hero.rarity);
  const rarTextClass = rarityTextClass(rarityIndex) ?? 'text-muted';
  const starCount = Math.max(0, Math.min(MAX_STARS, Math.round(hero.stars ?? 0)));
  const rankMark = hero.rank?.trim() || '—';

  const identity = (
    <>
      <HeroAvatar
        skin={hero.skin ?? 0}
        rarityIdx={rarityIndex}
        size="lg"
        name={hero.name}
        className="shrink-0"
      />

      <div className="min-w-0">
        <div className="flex min-w-0 items-baseline gap-2">
          <span
            className={cn(
              'shrink-0 text-xl leading-none font-black tracking-tight',
              hero.rank ? 'text-accent' : 'text-muted',
            )}
            aria-label={t.heroRank}
          >
            {rankMark}
          </span>
          <Tooltip.Provider delay={200} closeDelay={80}>
            <Tooltip.Root>
              <Tooltip.Trigger
                render={<p className="min-w-0 truncate text-base leading-none font-bold text-ink" />}
              >
                <span className={rarTextClass}>{hero.name}</span>
                {starCount > 0 ? (
                  <span className="ml-1 text-[0.92em] tracking-tight text-rar-4" aria-hidden="true">
                    {'★'.repeat(starCount)}
                  </span>
                ) : null}
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Positioner sideOffset={6}>
                  <Tooltip.Popup>{hero.name}</Tooltip.Popup>
                </Tooltip.Positioner>
              </Tooltip.Portal>
            </Tooltip.Root>
          </Tooltip.Provider>
        </div>
        <div className="mt-1 flex min-w-0 items-center gap-1.5">
          <span className={`shrink-0 text-[11px] leading-none font-bold ${rarTextClass}`}>
            {rarityLabel(hero.rarity, lang)}
          </span>
          <span className="font-mono text-[11px] tabular-nums text-muted">L{hero.level}</span>
        </div>
      </div>
    </>
  );

  if (!renderPicker) {
    return (
      <div className="mb-3 grid w-full max-w-xl grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2.5 border border-line bg-[color-mix(in_oklch,var(--bg)_35%,var(--surface))] px-2.5 py-1.5 text-left">
        {identity}
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        className="group mb-3 grid w-full max-w-xl cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2.5 border border-line bg-[color-mix(in_oklch,var(--bg)_35%,var(--surface))] px-2.5 py-1.5 text-left transition-colors hover:bg-[color-mix(in_oklch,var(--accent)_6%,var(--surface))] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
        onClick={() => setPickerOpen(true)}
        aria-label={t.heroStripSwitch}
      >
        {identity}

        <div
          className="flex shrink-0 items-center gap-1.5 self-stretch border-l border-line pl-2 text-muted transition-colors group-hover:text-accent"
          aria-hidden="true"
        >
          <Icon name="swap" size="sm" className="shrink-0" />
          <div className="flex flex-col leading-none">
            <span className="text-[8px] font-bold tracking-[0.08em] uppercase">{t.switchHeroShort}</span>
            <span className="font-mono text-[11px] font-semibold tabular-nums">{heroes.length}</span>
          </div>
        </div>
      </button>

      {renderPicker({
        open: pickerOpen,
        onOpenChange: setPickerOpen,
        heroes,
        heroId: hero.id,
        formatNumber,
        onSelectHero,
      })}
    </>
  );
}

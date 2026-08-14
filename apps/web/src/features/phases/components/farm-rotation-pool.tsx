'use client';

import { sub, type Strings } from '@/shared/i18n';
import { Switch, Tooltip, cn } from '@bombfarm/ui';
import type { FarmPoolEntry } from '@/shared/stores';

type Props = {
  entries: FarmPoolEntry[];
  onToggle: (heroId: string, enabled: boolean) => void;
  t: Strings;
};

/**
 * Inline, horizontally-scrolling Switch chip row — one per roster hero (`ASM-C10`).
 * Composes `Switch` + `Tooltip` locally rather than importing `roster`'s `HeroActiveToggle`
 * (`TD-8`): that component is bound to `battleAllowed` semantics and a cross-feature reach for
 * it would need a new lint allowlist entry for a control whose meaning here is different
 * (estimation-local, never a save write — `AD-PFR-05`, `AD-PFRC-05`).
 */
export function FarmRotationPool({ entries, onToggle, t }: Props) {
  if (entries.length === 0) return null;

  return (
    <div
      role="group"
      aria-label={t.farmRankingPoolLabel}
      data-testid="farm-pool"
      className="flex flex-wrap items-center gap-2 overflow-x-auto"
    >
      <span className="text-[11px] font-bold tracking-[0.03em] text-muted uppercase">
        {t.farmRankingPoolLabel}
      </span>
      <Tooltip.Provider delay={200} closeDelay={80}>
        {entries.map((entry) => (
          <Tooltip.Root key={entry.heroId}>
            <Tooltip.Trigger
              render={<span />}
              className={cn(
                'inline-flex shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface px-2 py-1',
              )}
              data-testid={`farm-pool-hero-${entry.heroId}`}
            >
              <Switch
                checked={entry.enabled}
                onCheckedChange={(checked) => onToggle(entry.heroId, checked)}
                aria-label={sub(t.farmRankingPoolHeroAria, { name: entry.heroName })}
              />
              <span className="max-w-32 truncate text-xs whitespace-nowrap text-ink">
                {entry.heroName}
              </span>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner sideOffset={6}>
                <Tooltip.Popup>{entry.heroName}</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        ))}
      </Tooltip.Provider>
    </div>
  );
}

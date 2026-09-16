'use client';

import { useState } from 'react';
import type { SheetKey } from '@bombfarm/domain/planner-constants';
import { RUNE_AXIS_SHEET_KEY, runesOf, type HeroRune } from '@bombfarm/domain/runes';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';
import { RuneIcon, rarityTextClass } from '@bombfarm/game-art';
import { Collapsible, Panel, cn, formatNumber, panelTitleClass, tipClass } from '@bombfarm/ui';
import { heroCopyFor, sub, type HeroCopy, type Lang } from '../copy';

const axisLabelClass = 'truncate text-[10px] font-bold tracking-[0.08em] text-muted uppercase';

type StatLabel = (key: SheetKey) => string;

/** The statistic a rune multiplies, in the host's own stat vocabulary; xp and gold are not statistics. */
function runeAxisLabel(rune: HeroRune, t: HeroCopy, statLabel: StatLabel): string {
  const key = RUNE_AXIS_SHEET_KEY[rune.axis];
  if (key !== null) return statLabel(key);
  return rune.axis === 'xp' ? t.heroDetailRuneAxisXp : t.heroDetailRuneAxisGold;
}

function RuneTile({
  rune,
  t,
  lang,
  statLabel,
}: {
  rune: HeroRune;
  t: HeroCopy;
  lang: Lang;
  statLabel: StatLabel;
}) {
  return (
    <li className="flex min-w-0 items-center gap-3 border border-line px-2.5 py-2">
      <RuneIcon axis={rune.axis} rarityIdx={rune.rarity} size="md" className="shrink-0" />
      <div className="min-w-0">
        <p className={axisLabelClass}>{runeAxisLabel(rune, t, statLabel)}</p>
        <p
          className={cn(
            'mt-1 font-mono text-sm leading-tight font-bold tabular-nums',
            rarityTextClass(rune.rarity) ?? 'text-ink',
          )}
        >
          {sub(t.heroDetailRuneStrength, { pct: formatNumber(rune.strengthPct, lang, 0) })}
        </p>
        <p className="mt-0.5 text-[11px] leading-tight text-muted">
          {sub(t.heroDetailRunePlayLeft, { hours: formatNumber(rune.playSecondsLeft / 3600, lang, 0) })}
        </p>
      </div>
    </li>
  );
}

/**
 * The timed buffs the hero carries today, on the Combat stage under the phase pick — every figure
 * below them counts them, and they are the one input on that stage the player cannot change.
 *
 * Drawn only for a hero that carries one, and folded by default: the tiles are a reminder rather
 * than a control. The folded header keeps each rune's sprite, so a glance still says what the
 * figures are inflated by.
 */
export function HeroRunesPanel({
  hero,
  lang,
  statLabel,
  defaultOpen = false,
}: {
  hero: HeroRecord;
  lang: Lang;
  statLabel: StatLabel;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const t = heroCopyFor(lang);
  const runes = runesOf(hero);
  if (runes.length === 0) return null;

  return (
    <Panel data-testid="hero-runes-panel" className="min-w-0">
      <Collapsible.Root open={open} onOpenChange={setOpen}>
        <h2 className={cn(panelTitleClass, 'flex flex-wrap items-center gap-x-3 gap-y-1')}>
          <Collapsible.Trigger tone="panel">{t.heroDetailRunesTitle}</Collapsible.Trigger>
          {open ? null : (
            <span className="flex items-center gap-1" data-testid="hero-runes-folded" aria-hidden="true">
              {runes.map((rune, index) => (
                <RuneIcon key={`${rune.axis}-${String(index)}`} axis={rune.axis} rarityIdx={rune.rarity} size="xs" />
              ))}
            </span>
          )}
        </h2>
        <Collapsible.Panel>
          <p className={cn(tipClass, 'mt-1.5')}>{t.heroDetailRunesTip}</p>
          {/* Tiles per row follow the panel's own width, not the viewport's — the stage sits in a
              detail column on one host and a tab strip on the other. Every tile is the same
              shape, so a wrapped row still reads. */}
          <div className="@container">
            <ul className="mt-2 grid list-none grid-cols-1 gap-2 p-0 @min-[30rem]:grid-cols-2 @min-[52rem]:grid-cols-3">
              {runes.map((rune, index) => (
                <RuneTile
                  key={`${rune.axis}-${String(index)}`}
                  rune={rune}
                  t={t}
                  lang={lang}
                  statLabel={statLabel}
                />
              ))}
            </ul>
          </div>
        </Collapsible.Panel>
      </Collapsible.Root>
    </Panel>
  );
}

'use client';

/**
 * The card a player sends a friend: who they are, how far they have got, their strongest heroes
 * with the gear and abilities that made them, which team auras the squad covers, and everyone
 * else on it.
 *
 * Drawn at a fixed width so the picture it is turned into has the same shape on every screen, and
 * with no hover card or control inside it — it is the picture.
 */
import { useMemo, type Ref } from 'react';
import { rarityLabel } from '@bombfarm/domain/game-labels';
import { RARITIES } from '@bombfarm/domain/planner-constants';
import { rarityDotClass } from '@bombfarm/game-art';
import { Chip, cn, formatCompactNumber, numberFormatterFor } from '@bombfarm/ui';
import { SITE_HOST } from '@bombfarm/ui/site-address';
import { shareCardCopyFor, sub, type Lang, type ShareCardCopy } from '../../copy';
import {
  auraCoverageFor,
  type ShareCardLayout,
  type ShareCardSettings,
  type ShareCardTotals,
} from '../../model';
import { ShareAuraGrid } from './share-card-auras';
import { ShareFeaturedTile } from './share-card-featured';
import { shareEyebrowClass } from './share-card-parts';
import { ShareRestRow } from './share-card-rest';

export const SHARE_CARD_WIDTH_PX = 680;

export type ShareCardIdentity = {
  readonly playerName: string | null;
  readonly accountId: string | null;
  readonly maxPhase: number | null;
};

export function ShareCard({
  layout,
  settings,
  identity,
  dps,
  lang,
  ref,
}: {
  layout: ShareCardLayout;
  settings: ShareCardSettings;
  identity: ShareCardIdentity;
  /** Sustained DPS at `settings.phase` by hero id; a hero missing from it prints a dash. */
  dps: ReadonlyMap<string, number>;
  lang: Lang;
  ref?: Ref<HTMLDivElement>;
}) {
  const copy = shareCardCopyFor(lang);
  const coverage = useMemo(
    () => auraCoverageFor(layout.picked.map((row) => row.hero), lang, numberFormatterFor(lang)),
    [layout.picked, lang],
  );

  return (
    <div
      ref={ref}
      role="img"
      aria-label={copy.cardLabel}
      data-testid="share-card"
      className={cn(
        'shrink-0',
        'overflow-hidden',
        'rounded-2xl',
        'border',
        'border-line',
        'font-sans',
        'text-ink',
        'bg-bg',
        '[background-image:radial-gradient(120%_80%_at_100%_0%,color-mix(in_oklch,var(--accent)_22%,transparent)_0%,transparent_55%),linear-gradient(180deg,var(--surface)_0%,var(--bg)_100%)]',
      )}
      style={{ width: SHARE_CARD_WIDTH_PX }}
    >
      <ShareCardHeader identity={identity} settings={settings} totals={layout.totals} copy={copy} lang={lang} />
      <TierChips totals={layout.totals} copy={copy} lang={lang} />
      {layout.featured.length > 0 ? (
        <div className="grid grid-cols-3 gap-2.5 px-[22px]">
          {layout.featured.map((row, index) => (
            <ShareFeaturedTile
              key={row.id}
              featured={{ row, medal: copy.medalPower[index] ?? '', dps: dps.get(row.id) }}
              show={settings}
              copy={copy}
              lang={lang}
            />
          ))}
        </div>
      ) : (
        <p className="m-0 px-[22px] text-sm text-muted">{copy.emptyCard}</p>
      )}
      {settings.showAuras && layout.picked.length > 0 ? (
        <ShareAuraGrid coverage={coverage} copy={copy} lang={lang} />
      ) : null}
      {layout.rest.length > 0 ? (
        <section className="grid gap-2 px-[22px] pt-4 pb-1.5" data-testid="share-card-rest">
          <p className={shareEyebrowClass}>{copy.restTitle}</p>
          <div className="grid grid-cols-2 gap-1.5">
            {layout.rest.map((row) => (
              <ShareRestRow key={row.id} row={row} dps={dps.get(row.id)} copy={copy} lang={lang} />
            ))}
          </div>
        </section>
      ) : null}
      <footer className="mt-3.5 flex items-center justify-between gap-2.5 border-t border-[color-mix(in_oklch,var(--line)_70%,transparent)] px-[22px] pt-3.5 pb-[18px] text-[11px] text-muted">
        <span data-testid="share-card-footer-phase">{sub(copy.footerSnapshot, { phase: settings.phase })}</span>
        <span className="font-mono text-[11.5px] font-medium text-accent">{sub(copy.footerLink, { host: SITE_HOST })}</span>
      </footer>
    </div>
  );
}

function ShareCardHeader({
  identity,
  settings,
  totals,
  copy,
  lang,
}: {
  identity: ShareCardIdentity;
  settings: ShareCardSettings;
  totals: ShareCardTotals;
  copy: ShareCardCopy;
  lang: Lang;
}) {
  const subtitle = [
    settings.showAccountNumber && identity.accountId !== null ? sub(copy.accountNumber, { id: identity.accountId }) : null,
    sub(copy.currentPhase, { phase: settings.phase }),
    identity.maxPhase === null ? null : sub(copy.maxPhase, { phase: identity.maxPhase }),
  ]
    .filter((part) => part !== null)
    .join(copy.separator);

  return (
    <header className="flex items-start justify-between gap-4 px-[22px] pt-5 pb-4">
      <div className="min-w-0">
        <p className="m-0 text-[11px] font-semibold tracking-[0.14em] text-accent uppercase">{copy.brand}</p>
        <h2 className="m-0 mt-1 truncate text-[26px] leading-tight font-bold text-ink" data-testid="share-card-title">
          {identity.playerName ?? copy.fallbackTitle}
        </h2>
        <p className="m-0 mt-0.5 text-xs text-muted" data-testid="share-card-subtitle">
          {subtitle}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="m-0 font-mono text-[34px] leading-none font-bold tabular-nums text-accent" data-testid="share-card-total-power">
          {formatCompactNumber(totals.totalPower, lang)}
        </p>
        <p className="m-0 mt-1 text-[11px] tracking-widest text-muted uppercase">{copy.totalPower}</p>
      </div>
    </header>
  );
}

const TIER_CHIP_CLASS = 'inline-flex cursor-default items-center gap-1.5 px-2 py-0.5 whitespace-nowrap text-ink';

function TierChips({ totals, copy, lang }: { totals: ShareCardTotals; copy: ShareCardCopy; lang: Lang }) {
  return (
    <div className="flex flex-wrap gap-1.5 px-[22px] pb-4" data-testid="share-card-chips">
      <Chip className={TIER_CHIP_CLASS} data-testid="share-card-hero-count">
        {totals.heroCount === 1 ? copy.heroCountOne : sub(copy.heroCount, { count: totals.heroCount })}
      </Chip>
      {totals.tierCounts.map(({ rarity, count }) => (
        <Chip key={rarity} className={TIER_CHIP_CLASS}>
          <span className={cn('inline-block', 'size-[7px]', 'rounded-full', rarityDotClass(RARITIES.indexOf(rarity)))} aria-hidden />
          {sub(copy.tierCount, { count, rarity: rarityLabel(rarity, lang) })}
        </Chip>
      ))}
    </div>
  );
}

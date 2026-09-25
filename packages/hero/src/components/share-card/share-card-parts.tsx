import { rarityLabel } from '@bombfarm/domain/game-labels';
import { heroAbilityIconEntries } from '@bombfarm/domain/hero-abilities';
import { RARITIES } from '@bombfarm/domain/planner-constants';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';
import { AbilityIcon, rarityTextClass } from '@bombfarm/game-art';
import { cn } from '@bombfarm/ui';
import { sub, type Lang, type ShareCardCopy } from '../../copy';
import { shareStars } from '../../model';

export const shareEyebrowClass = 'm-0 text-[11px] font-semibold tracking-[0.12em] text-muted uppercase';

/** The inner tiles' shared chrome: a darker well on the card's own gradient. */
export const shareWellClass = cn(
  'rounded-[10px]',
  'border',
  'border-[color-mix(in_oklch,var(--line)_70%,transparent)]',
  'bg-[color-mix(in_oklch,var(--bg)_60%,transparent)]',
);

export function rarityIndexOf(hero: Pick<HeroRecord, 'rarity'>): number {
  return Math.max(0, RARITIES.indexOf(hero.rarity));
}

export function ShareStars({ stars }: { stars: number }) {
  const { filled, empty } = shareStars(stars);
  return (
    <span className="shrink-0 text-[11px] leading-none tracking-[1px]" aria-hidden>
      <span className="text-gold">{'★'.repeat(filled)}</span>
      <span className="text-line">{'★'.repeat(empty)}</span>
    </span>
  );
}

export function RarityLevel({
  hero,
  copy,
  lang,
}: {
  hero: Pick<HeroRecord, 'rarity' | 'level'>;
  copy: ShareCardCopy;
  lang: Lang;
}) {
  const [before, after] = copy.rarityLevel.split('{rarity}');
  return (
    <span className="truncate text-[11px] text-muted">
      {before}
      <span className={cn('font-semibold', rarityTextClass(rarityIndexOf(hero)))}>
        {rarityLabel(hero.rarity, lang)}
      </span>
      {sub(after ?? '', { level: hero.level })}
    </span>
  );
}

/** A hero's pool as bare art: the card is a picture, so nothing on it opens a hover card. */
export function ShareAbilityIcons({
  abilities,
  tileClassName,
  gapPx,
}: {
  abilities: Record<string, number>;
  tileClassName: string;
  gapPx: number;
}) {
  return (
    <span className="flex flex-nowrap items-center justify-center" style={{ gap: gapPx }}>
      {heroAbilityIconEntries(abilities).map(({ id }) => (
        <AbilityIcon key={id} code={id} size="xs" className={tileClassName} />
      ))}
    </span>
  );
}

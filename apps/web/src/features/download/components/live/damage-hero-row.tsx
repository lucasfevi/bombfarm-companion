import { formatCompactNumber } from '@bombfarm/ui';
import { HeroIdentity } from '@/shared/game-art';
import type { Lang } from '@/shared/i18n';
import type { ReplicaDamageHero } from '../../model/live-replica-data';
import { DAMAGE_FIGURE_CLASS, DAMAGE_ROW_COLUMNS } from './damage-table';

export function DamageHeroRow({ hero, lang }: { hero: ReplicaDamageHero; lang: Lang }) {
  const compact = (value: number) => formatCompactNumber(value, lang);
  return (
    <li className={`${DAMAGE_ROW_COLUMNS} h-10`}>
      <HeroIdentity
        name={hero.name}
        rank={hero.grade}
        rarityIdx={hero.rarity}
        stars={hero.stars}
        level={hero.level}
        skin={hero.skin}
        lang={lang}
        size="xs"
        showRarity={false}
      />
      <span className={DAMAGE_FIGURE_CLASS}>{compact(hero.dps)}</span>
      <span className={DAMAGE_FIGURE_CLASS}>{`${String(Math.round(hero.uptime * 100))}%`}</span>
      <span className={DAMAGE_FIGURE_CLASS}>{compact(hero.props)}</span>
      <span className={`${DAMAGE_FIGURE_CLASS} text-gold`}>{compact(hero.gold)}</span>
    </li>
  );
}

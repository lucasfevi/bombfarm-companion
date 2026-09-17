import { RARITIES } from '@bombfarm/domain/planner-constants';
import { DataTable, formatCompactNumber } from '@bombfarm/ui';
import { HeroAbilityIcons, HeroIdentity, heroPeekData } from '@/shared/game-art';
import type { Lang } from '@/shared/i18n';
import type { HeroRecord } from '@/shared/lib/storage';

export function PlannerCardRow({ hero, dps, lang }: { hero: HeroRecord; dps: number; lang: Lang }) {
  return (
    <DataTable.Row>
      <DataTable.Cell nowrap={false}>
        <HeroIdentity
          variant="inline"
          name={hero.name}
          rank={hero.rank}
          rarityIdx={RARITIES.indexOf(hero.rarity)}
          stars={hero.stars}
          level={hero.level}
          skin={hero.skin}
          lang={lang}
          peek={heroPeekData(hero)}
        />
      </DataTable.Cell>
      <DataTable.Cell align="right" numeric>
        {hero.power == null ? '—' : formatCompactNumber(hero.power, lang)}
      </DataTable.Cell>
      <DataTable.Cell align="right" numeric>
        {formatCompactNumber(dps, lang)}
      </DataTable.Cell>
      <DataTable.Cell>
        <HeroAbilityIcons abilities={hero.abilities} lang={lang} size="md" />
      </DataTable.Cell>
    </DataTable.Row>
  );
}

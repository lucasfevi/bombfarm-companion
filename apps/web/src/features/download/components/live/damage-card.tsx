import { Icon, Panel, formatCompactNumber } from '@bombfarm/ui';
import { HeroIdentity } from '@/shared/game-art';
import { sub, type Lang } from '@/shared/i18n';
import { liveLabel } from '../../model/live-replica-copy';
import type { ReplicaDamage, ReplicaDamageHero } from '../../model/live-replica-data';
import { ReplicaCardHead } from './replica-card-head';

const ROW_COLUMNS = 'grid grid-cols-[minmax(0,1fr)_6rem_5rem_6rem] items-center gap-2 px-2';
const FIGURE_CLASS = 'text-right font-mono text-xs text-ink tabular-nums';

function TeamFigure({ caption, value }: { caption: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] tracking-wide text-muted uppercase whitespace-nowrap">{caption}</span>
      <span className="text-[20px] leading-none font-bold text-ink tabular-nums">{value}</span>
    </div>
  );
}

function HeroRow({ hero, lang }: { hero: ReplicaDamageHero; lang: Lang }) {
  const compact = (value: number) => formatCompactNumber(value, lang);
  return (
    <li className={`${ROW_COLUMNS} h-10`}>
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
      <span className={FIGURE_CLASS}>{compact(hero.dps)}</span>
      <span className={FIGURE_CLASS}>{compact(hero.props)}</span>
      <span className={`${FIGURE_CLASS} text-gold`}>{compact(hero.gold)}</span>
    </li>
  );
}

function UnattributedRow({ lang, amounts }: { lang: Lang; amounts: ReplicaDamage['unattributed'] }) {
  const compact = (value: number) => formatCompactNumber(value, lang);
  return (
    <div className={`${ROW_COLUMNS} h-10 border-t border-line/55 text-muted`}>
      <span className="truncate text-[12px] font-bold">{liveLabel('liveDamageUnattributedLabel', lang)}</span>
      <span className={`${FIGURE_CLASS} text-muted`}>{compact(amounts.dps)}</span>
      <span className={`${FIGURE_CLASS} text-muted`}>{compact(amounts.props)}</span>
      <span className={`${FIGURE_CLASS} text-muted`}>{compact(amounts.gold)}</span>
    </div>
  );
}

/** Sized to its table, not stretched across the row, as the desktop's panel is. */
export function DamageCard({ lang, damage }: { lang: Lang; damage: ReplicaDamage }) {
  const compact = (value: number) => formatCompactNumber(value, lang);
  const teamDps = liveLabel('liveDamageTeamDpsLabel', lang);

  return (
    <Panel
      data-testid="replica-live-damage"
      className="flex w-full max-w-140 flex-col gap-3 self-start p-3"
    >
      <ReplicaCardHead
        title={liveLabel('liveDamageTitle', lang)}
        info={<Icon name="information-circle" size="xs" className="text-muted" />}
      />
      <div className="flex flex-wrap gap-x-8 gap-y-2">
        <TeamFigure
          caption={`${teamDps} ${sub(liveLabel('liveEarningsRecentWindowLabel', lang), { minutes: damage.coverageMinutes })}`}
          value={compact(damage.teamDps10)}
        />
        <TeamFigure
          caption={`${teamDps} ${liveLabel('liveDamageSessionWindowLabel', lang)}`}
          value={compact(damage.teamDpsSession)}
        />
      </div>
      <div className="flex flex-col">
        <div
          className={`${ROW_COLUMNS} h-8 border-b border-line text-[10px] font-semibold tracking-[0.02em] text-muted uppercase`}
        >
          <span>{liveLabel('liveDamageHeroColumn', lang)}</span>
          <span className="text-right">{liveLabel('liveDamageDpsColumn', lang)}</span>
          <span className="text-right">{liveLabel('liveDamagePropsColumn', lang)}</span>
          <span className="text-right">{liveLabel('liveDamageGoldColumn', lang)}</span>
        </div>
        <ul className="m-0 flex list-none flex-col p-0">
          {damage.heroes.map((hero) => (
            <HeroRow key={hero.id} hero={hero} lang={lang} />
          ))}
        </ul>
        <UnattributedRow lang={lang} amounts={damage.unattributed} />
      </div>
    </Panel>
  );
}

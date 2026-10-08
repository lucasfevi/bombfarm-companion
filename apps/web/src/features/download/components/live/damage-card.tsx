import { Icon, Panel, cn, formatCompactNumber } from '@bombfarm/ui';
import { sub, type Lang } from '@/shared/i18n';
import { liveLabel } from '../../model/live-replica-copy';
import type { ReplicaDamage } from '../../model/live-replica-data';
import { DamageHeroRow } from './damage-hero-row';
import { DamageTeamFigure } from './damage-team-figure';
import { DAMAGE_ROW_COLUMNS } from './damage-table';
import { DamageUnattributedRow } from './damage-unattributed-row';
import { ReplicaCardHead } from './replica-card-head';

export function DamageCard({ lang, damage, className }: { lang: Lang; damage: ReplicaDamage; className?: string }) {
  const compact = (value: number) => formatCompactNumber(value, lang);
  const teamDps = liveLabel('liveDamageTeamDpsLabel', lang);

  return (
    <Panel data-testid="replica-live-damage" className={cn('flex min-w-0 flex-col gap-3 p-3', className)}>
      <ReplicaCardHead
        title={liveLabel('liveDamageTitle', lang)}
        info={<Icon name="information-circle" size="xs" className="text-muted" />}
      />
      <div className="flex flex-wrap gap-x-8 gap-y-2">
        <DamageTeamFigure
          caption={`${teamDps} ${sub(liveLabel('liveEarningsRecentWindowLabel', lang), { minutes: damage.coverageMinutes })}`}
          value={compact(damage.teamDps10)}
        />
        <DamageTeamFigure
          caption={`${teamDps} ${liveLabel('liveDamageSessionWindowLabel', lang)}`}
          value={compact(damage.teamDpsSession)}
        />
      </div>
      <div className="flex flex-col">
        <div
          className={`${DAMAGE_ROW_COLUMNS} h-8 border-b border-line text-[10px] font-semibold tracking-[0.02em] text-muted uppercase`}
        >
          <span>{liveLabel('liveDamageHeroColumn', lang)}</span>
          <span className="text-right">{liveLabel('liveDamageDpsColumn', lang)}</span>
          <span className="text-right">{liveLabel('liveDamageUptimeColumn', lang)}</span>
          <span className="text-right">{liveLabel('liveDamagePropsColumn', lang)}</span>
          <span className="text-right">{liveLabel('liveDamageGoldColumn', lang)}</span>
        </div>
        <ul className="m-0 flex list-none flex-col p-0">
          {damage.heroes.map((hero) => (
            <DamageHeroRow key={hero.id} hero={hero} lang={lang} />
          ))}
        </ul>
        <DamageUnattributedRow lang={lang} amounts={damage.unattributed} />
      </div>
    </Panel>
  );
}

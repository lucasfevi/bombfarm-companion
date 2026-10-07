import { formatCompactNumber } from '@bombfarm/ui';
import type { Lang } from '@/shared/i18n';
import { liveLabel } from '../../model/live-replica-copy';
import type { ReplicaDamage } from '../../model/live-replica-data';
import { DAMAGE_FIGURE_CLASS, DAMAGE_ROW_COLUMNS } from './damage-table';

export function DamageUnattributedRow({ lang, amounts }: { lang: Lang; amounts: ReplicaDamage['unattributed'] }) {
  const compact = (value: number) => formatCompactNumber(value, lang);
  return (
    <div className={`${DAMAGE_ROW_COLUMNS} h-10 border-t border-line/55 text-muted`}>
      <span className="truncate text-[12px] font-bold">{liveLabel('liveDamageUnattributedLabel', lang)}</span>
      <span className={`${DAMAGE_FIGURE_CLASS} text-muted`}>{compact(amounts.dps)}</span>
      <span className={`${DAMAGE_FIGURE_CLASS} text-muted`}>{compact(amounts.props)}</span>
      <span className={`${DAMAGE_FIGURE_CLASS} text-muted`}>{compact(amounts.gold)}</span>
    </div>
  );
}

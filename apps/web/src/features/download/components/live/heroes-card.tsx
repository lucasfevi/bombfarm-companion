import { Panel } from '@bombfarm/ui';
import type { Lang } from '@/shared/i18n';
import { liveLabel } from '../../model/live-replica-copy';
import type { ReplicaFrame } from '../../model/live-replica-data';
import { ReplicaCardHead } from './replica-card-head';
import { ReplicaHeroRow } from './replica-hero-row';
import { SummaryCount } from './summary-count';

export function HeroesCard({
  lang,
  summary,
  heroes,
}: {
  lang: Lang;
  summary: ReplicaFrame['summary'];
  heroes: ReplicaFrame['heroes'];
}) {
  return (
    <Panel className="p-3">
      <ReplicaCardHead title={liveLabel('liveHeroesTitle', lang)} />
      <div className="mb-2 flex flex-wrap gap-4 font-mono text-[10px] text-muted">
        <SummaryCount
          label={liveLabel('liveListOnFieldTitle', lang)}
          value={summary.onField}
        />
        <SummaryCount
          label={liveLabel('liveListRecoveringTitle', lang)}
          value={summary.resting}
        />
        <SummaryCount label={liveLabel('liveListQueuedTitle', lang)} value={summary.idle} />
        <SummaryCount
          label={liveLabel('liveListBenchedTitle', lang)}
          value={summary.benched}
        />
      </div>
      <ul className="m-0 flex list-none flex-col gap-1 p-0">
        {heroes.map((hero) => (
          <ReplicaHeroRow key={hero.id} hero={hero} />
        ))}
      </ul>
    </Panel>
  );
}

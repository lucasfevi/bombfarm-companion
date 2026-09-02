import { Panel } from '@bombfarm/ui';
import type { Lang } from '@/shared/i18n';
import { liveLabel } from '../../model/live-replica-copy';
import type { ReplicaDensity, ReplicaFrame } from '../../model/live-replica-data';
import { ReplicaCardHead } from './replica-card-head';
import { ReplicaHeroRow } from './replica-hero-row';
import { SummaryCount } from './summary-count';

export function HeroesCard({
  lang,
  summary,
  heroes,
  density = 'full',
}: {
  lang: Lang;
  summary: ReplicaFrame['summary'];
  heroes: ReplicaFrame['heroes'];
  density?: ReplicaDensity;
}) {
  const counts = (
    <>
      <SummaryCount label={liveLabel('liveListOnFieldTitle', lang)} value={summary.onField} />
      <SummaryCount label={liveLabel('liveListRecoveringTitle', lang)} value={summary.resting} />
      <SummaryCount label={liveLabel('liveListQueuedTitle', lang)} value={summary.idle} />
      <SummaryCount label={liveLabel('liveListBenchedTitle', lang)} value={summary.benched} />
    </>
  );

  const rows = heroes.map((hero) => (
    <ReplicaHeroRow key={hero.id} hero={hero} lang={lang} density={density} />
  ));

  if (density === 'compact') {
    return (
      <Panel className="flex w-80 max-w-full shrink-0 flex-col gap-2 p-2">
        <div className="flex flex-wrap gap-3 font-mono text-[10px] text-muted">{counts}</div>
        <ul className="m-0 flex list-none flex-col p-0">{rows}</ul>
      </Panel>
    );
  }

  return (
    <Panel className="p-3">
      <ReplicaCardHead title={liveLabel('liveHeroesTitle', lang)} />
      <div className="mb-2 flex flex-wrap gap-4 font-mono text-[10px] text-muted">{counts}</div>
      <ul className="m-0 flex list-none flex-col gap-1 p-0">{rows}</ul>
    </Panel>
  );
}

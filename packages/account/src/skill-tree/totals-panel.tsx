import { SKILL_TOTALS_KEYS, type SkillTotals } from '@bombfarm/domain/skill-tree';
import { GoldValue } from '@bombfarm/game-art';
import { InfoTip, Panel, StatList, cn, panelHClass, panelTitleClass, type StatListItem } from '@bombfarm/ui';
import { CompactFigure } from './compact-figure';
import { isIdentityTotal, type TreeSummary } from './node-facts';
import type { SkillTreeLabels } from './types';

export type TotalsPanelProps = {
  totals: SkillTotals;
  summary: TreeSummary;
  labels: SkillTreeLabels;
};

function share(part: number, whole: number): number {
  return whole > 0 ? part / whole : 0;
}

export function TotalsPanel({ totals, summary, labels }: TotalsPanelProps) {
  const rows: StatListItem[] = SKILL_TOTALS_KEYS.filter((key) => !isIdentityTotal(key, totals[key])).map((key) => ({
    id: key,
    label: labels.totalRows[key],
    value: labels.formatTotal(key, totals[key]),
  }));
  const treeGold = summary.goldSpent + summary.goldToMax;
  const gold = (amount: number) => (
    <GoldValue baseline>
      <CompactFigure compact={labels.goldCompact(amount)} exact={labels.gold(amount)} />
    </GoldValue>
  );
  const progress: StatListItem[] = [
    {
      id: 'levels',
      label: labels.levelsBought,
      value: (
        <span data-testid="skill-tree-progress">
          {labels.countOf(summary.ownedLevels, summary.totalLevels)}
          <span className="ml-1.5 text-muted">{labels.share(share(summary.ownedLevels, summary.totalLevels))}</span>
        </span>
      ),
    },
    {
      id: 'gold-spent',
      label: labels.goldSpent,
      value: (
        <>
          {gold(summary.goldSpent)}
          <span className="ml-1.5 text-muted">{labels.share(share(summary.goldSpent, treeGold))}</span>
        </>
      ),
    },
    { id: 'gold-to-max', label: labels.goldToMax, value: gold(summary.goldToMax) },
  ];
  return (
    <Panel data-testid="skill-tree-totals">
      <div className={panelHClass}>
        <h2 className={cn(panelTitleClass, 'flex items-center gap-1.5')}>
          {labels.totals}
          <InfoTip label={labels.totals} tip={labels.totalsTip} />
        </h2>
      </div>
      {rows.length > 0 ? <StatList variant="phases" items={rows} aria-label={labels.totals} /> : null}
      <StatList variant="phases" className="mt-2 border-t border-line pt-2" items={progress} aria-label={labels.goldSpent} />
    </Panel>
  );
}

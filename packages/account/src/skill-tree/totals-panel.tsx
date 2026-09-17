import { SKILL_TOTALS_KEYS, type SkillTotals } from '@bombfarm/domain/skill-tree';
import { Panel, PanelHeader, StatList, tipClass, type StatListItem } from '@bombfarm/ui';
import { isIdentityTotal, type TreeSummary } from './node-facts';
import type { SkillTreeLabels } from './types';

export type TotalsPanelProps = {
  totals: SkillTotals;
  summary: TreeSummary;
  labels: SkillTreeLabels;
};

export function TotalsPanel({ totals, summary, labels }: TotalsPanelProps) {
  const rows: StatListItem[] = SKILL_TOTALS_KEYS.filter((key) => !isIdentityTotal(key, totals[key])).map((key) => ({
    id: key,
    label: labels.totalRows[key],
    value: labels.formatTotal(key, totals[key]),
  }));
  const progress: StatListItem[] = [
    { id: 'gold-spent', label: labels.goldSpent, value: labels.gold(summary.goldSpent) },
    { id: 'gold-to-max', label: labels.goldToMax, value: labels.gold(summary.goldToMax) },
  ];
  return (
    <Panel data-testid="skill-tree-totals">
      <PanelHeader title={labels.totals} />
      <p className={tipClass}>{labels.totalsTip}</p>
      {rows.length > 0 ? <StatList variant="phases" items={rows} aria-label={labels.totals} /> : null}
      <p className="m-0 mt-2 border-t border-line pt-2 font-mono text-[11px] text-muted" data-testid="skill-tree-progress">
        {labels.treeProgress(summary.ownedLevels, summary.totalLevels)}
      </p>
      <StatList variant="phases" items={progress} aria-label={labels.goldSpent} />
    </Panel>
  );
}

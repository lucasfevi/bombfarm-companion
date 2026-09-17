import type { SkillNode, SkillNodeGain, SkillNodeStatus, SkillPricingObjective, SkillTreePricing } from '@bombfarm/domain/skill-tree';
import { Panel, PanelHeader, cn, tipClass } from '@bombfarm/ui';
import { objectiveDelta, objectivePerMillion } from './node-facts';
import type { SkillTreeLabels } from './types';

export type RecommendationRow = {
  readonly node: SkillNode;
  readonly gain: SkillNodeGain;
  readonly status: SkillNodeStatus;
};

export type NextToBuyPanelProps = {
  pricing: SkillTreePricing | null;
  rows: readonly RecommendationRow[];
  objective: SkillPricingObjective;
  selectedId: string | null;
  onSelect: (id: string) => void;
  nodeArtSrc: (node: SkillNode) => string | null;
  nodeName: (node: SkillNode) => string;
  labels: SkillTreeLabels;
};

const rowGridClass = 'grid grid-cols-[minmax(0,1fr)_auto_auto_auto] items-center gap-x-2.5';
const numericClass = 'text-right font-mono text-[11px] tabular-nums';

function Medallion({ node, src, className }: { node: SkillNode; src: string | null; className?: string }) {
  if (src === null) return <span aria-hidden className={cn('inline-block shrink-0 rounded-full border border-line bg-bg-2', className)} />;
  return <img alt="" src={src} data-node-art={node.id} className={cn('shrink-0 rounded-full object-cover', className)} />;
}

export function NextToBuyPanel({ pricing, rows, objective, selectedId, onSelect, nodeArtSrc, nodeName, labels }: NextToBuyPanelProps) {
  const gainLabel = objective === 'goldPerHour' ? labels.gainGold : labels.gainDps;
  const perMillionLabel = objective === 'goldPerHour' ? labels.perMillionGold : labels.perMillionDps;
  return (
    <Panel data-testid="skill-tree-next-to-buy">
      <PanelHeader title={labels.nextToBuy} />
      <p className={tipClass}>{labels.nextToBuyTip}</p>
      {pricing === null ? (
        <p className="m-0 text-xs text-muted" role="status">
          {labels.pricingUnavailable}
        </p>
      ) : rows.length === 0 ? (
        <p className="m-0 text-xs text-muted" role="status">
          {labels.nothingToRecommend}
        </p>
      ) : (
        <>
          <div className={cn(rowGridClass, 'mb-1 text-[10px] font-bold tracking-[0.08em] text-muted uppercase')} aria-hidden>
            <span>{labels.colNode}</span>
            <span className="text-right">{labels.colCost}</span>
            <span className="text-right">{labels.colGain}</span>
            <span className="text-right">{labels.colPerMillion}</span>
          </div>
          <ol className="m-0 flex list-none flex-col gap-0.5 p-0" aria-label={labels.nextToBuy}>
            {rows.map(({ node, gain, status }) => {
              const delta = objectiveDelta(gain, objective) ?? 0;
              const perMillion = objectivePerMillion(gain, objective) ?? 0;
              const selected = selectedId === node.id;
              return (
                <li key={node.id}>
                  <button
                    type="button"
                    data-testid={`skill-tree-recommendation-${node.id}`}
                    data-node-id={node.id}
                    aria-pressed={selected}
                    onClick={() => onSelect(node.id)}
                    className={cn(
                      rowGridClass,
                      'w-full cursor-pointer rounded-sm border px-1.5 py-1 text-left text-xs text-ink motion-safe:transition-[border-color,background-color] motion-safe:duration-[120ms]',
                      selected
                        ? 'border-accent bg-[color-mix(in_oklch,var(--accent)_10%,var(--surface))]'
                        : 'border-transparent hover:border-line hover:bg-bg-2',
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <Medallion node={node} src={nodeArtSrc(node)} className="size-6" />
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate font-semibold">{nodeName(node)}</span>
                        <span className="flex items-center gap-1.5 text-[10px] whitespace-nowrap text-muted">
                          <span className="font-mono">{labels.totalNowNext(String(gain.level), String(gain.level + 1))}</span>
                          {status.affordable === true ? (
                            <span className="text-up" data-testid={`skill-tree-affordable-${node.id}`}>
                              {labels.affordableNow}
                            </span>
                          ) : null}
                        </span>
                      </span>
                    </span>
                    <span className={cn(numericClass, 'text-gold')}>{labels.goldCompact(gain.cost)}</span>
                    <span className={cn(numericClass, delta < 0 ? 'text-down' : 'text-up')}>{gainLabel(delta)}</span>
                    <span className={cn(numericClass, 'text-muted')}>{perMillionLabel(perMillion)}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </>
      )}
      {pricing !== null && pricing.dpsLeftOut.length > 0 ? (
        <p className="m-0 mt-2 text-[11px] text-warn" data-testid="skill-tree-dps-left-out">
          {labels.dpsLeftOut(pricing.dpsLeftOut.join(', '))}
        </p>
      ) : null}
    </Panel>
  );
}

'use client';

import { useCallback, useMemo, useState } from 'react';
import { rankSkillGains, type SkillNode, type SkillNodeGain, type SkillPricingObjective } from '@bombfarm/domain/skill-tree';
import { FactTile, Panel, PanelHeader, SegmentedToggle, Tooltip, cn, tipClass } from '@bombfarm/ui';
import { NextToBuyPanel, type RecommendationRow } from './next-to-buy-panel';
import { objectiveDelta, statusMap, treeSummary } from './node-facts';
import { skillNodeDisplayName } from './node-name';
import { SelectedNodeCard } from './selected-node-card';
import { SkillTreeCanvas, SkillTreeLegend } from './skill-tree-canvas';
import { TotalsPanel } from './totals-panel';
import type { SkillTreeScreenProps } from './types';

export const DEFAULT_RECOMMENDATION_COUNT = 5;

const OBJECTIVES: readonly SkillPricingObjective[] = ['goldPerHour', 'teamDps'];

function isObjective(id: string): id is SkillPricingObjective {
  return (OBJECTIVES as readonly string[]).includes(id);
}

export function SkillTreeScreen({
  catalog,
  layout,
  state,
  totals,
  pricing,
  objective,
  onObjectiveChange,
  nodeArtSrc,
  labels,
  selectedId: controlledSelectedId,
  onSelect,
  recommendationCount = DEFAULT_RECOMMENDATION_COUNT,
  className,
}: SkillTreeScreenProps) {
  const [ownSelectedId, setOwnSelectedId] = useState<string | null>(null);
  const selectedId = controlledSelectedId === undefined ? ownSelectedId : controlledSelectedId;
  const select = useCallback(
    (id: string | null) => {
      onSelect?.(id);
      if (controlledSelectedId === undefined) setOwnSelectedId(id);
    },
    [onSelect, controlledSelectedId],
  );

  const nodeById = useMemo(() => new Map(catalog.nodes.map((node) => [node.id, node])), [catalog]);
  const statuses = useMemo(() => statusMap(catalog, state), [catalog, state]);
  const summary = useMemo(() => treeSummary(catalog, statuses), [catalog, statuses]);
  const gains = useMemo<ReadonlyMap<string, SkillNodeGain>>(
    () => new Map((pricing?.gains ?? []).map((gain) => [gain.id, gain])),
    [pricing],
  );
  const nodeName = useCallback((node: SkillNode) => skillNodeDisplayName(node, labels), [labels]);
  const parentName = useCallback(
    (id: string) => {
      const node = nodeById.get(id);
      return node ? nodeName(node) : id;
    },
    [nodeById, nodeName],
  );

  const recommendations = useMemo<RecommendationRow[]>(() => {
    if (!pricing) return [];
    const rows: RecommendationRow[] = [];
    for (const gain of rankSkillGains(pricing.gains, objective)) {
      if (rows.length >= recommendationCount) break;
      const delta = objectiveDelta(gain, objective);
      if (delta === null || !(delta > 0)) continue;
      const node = nodeById.get(gain.id);
      const status = statuses.get(gain.id);
      if (node && status) rows.push({ node, gain, status });
    }
    return rows;
  }, [pricing, objective, recommendationCount, nodeById, statuses]);
  const recommendedId = recommendations[0]?.node.id ?? null;

  const selectedNode = selectedId === null ? null : (nodeById.get(selectedId) ?? null);
  const selectedStatus = selectedNode ? (statuses.get(selectedNode.id) ?? null) : null;
  const selectedGain = selectedNode ? (gains.get(selectedNode.id) ?? null) : null;

  return (
    <Tooltip.Provider delay={180}>
      <div
        data-testid="skill-tree-screen"
        className={cn(
          // Fills the shell's region from 960px up so the canvas takes the height and the side column
          // scrolls on its own; stacked below that, the canvas keeps a fixed share of the viewport and
          // the whole screen scrolls.
          'grid min-w-0 grid-cols-1 items-stretch gap-2.5 min-[960px]:absolute min-[960px]:inset-0 min-[960px]:grid-cols-[minmax(0,1fr)_minmax(22rem,24rem)] min-[960px]:grid-rows-[minmax(0,1fr)]',
          className,
        )}
      >
        <Panel className="flex min-h-0 min-w-0 flex-col" data-testid="skill-tree-canvas-panel">
          <PanelHeader title={labels.title} />
          <p className={tipClass}>{labels.tip}</p>
          <SkillTreeCanvas
            catalog={catalog}
            layout={layout}
            statuses={statuses}
            gains={gains}
            objective={objective}
            selectedId={selectedId}
            recommendedId={recommendedId}
            onSelect={select}
            nodeArtSrc={nodeArtSrc}
            nodeName={nodeName}
            labels={labels}
          />
          <div className="mt-2">
            <SkillTreeLegend labels={labels} />
          </div>
        </Panel>

        <div className="flex min-h-0 min-w-0 flex-col gap-2.5 min-[960px]:overflow-y-auto min-[960px]:pr-0.5">
          <Panel data-testid="skill-tree-header">
            <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
              <FactTile size="headline" label={labels.wallet} value={state.gold === null ? '—' : labels.gold(state.gold)} valueClassName="text-gold" data-testid="skill-tree-wallet" />
              {pricing ? (
                <p className="m-0 text-[11px] text-muted" data-testid="skill-tree-priced-at">
                  {labels.pricedAtPhase(pricing.phase)}
                </p>
              ) : null}
              <SegmentedToggle
                ariaLabel={labels.nextToBuy}
                value={objective}
                onChange={(id) => {
                  if (isObjective(id)) onObjectiveChange(id);
                }}
                options={[
                  { id: 'goldPerHour', label: labels.objectiveGold },
                  { id: 'teamDps', label: labels.objectiveDps },
                ]}
              />
            </div>
          </Panel>

          <NextToBuyPanel
            pricing={pricing}
            rows={recommendations}
            objective={objective}
            selectedId={selectedId}
            onSelect={select}
            nodeArtSrc={nodeArtSrc}
            nodeName={nodeName}
            labels={labels}
          />

          <SelectedNodeCard
            node={selectedNode}
            status={selectedStatus}
            gain={selectedGain}
            pricing={pricing}
            nodeArtSrc={nodeArtSrc}
            nodeName={nodeName}
            parentName={parentName}
            labels={labels}
          />

          <TotalsPanel totals={totals} summary={summary} labels={labels} />
        </div>
      </div>
    </Tooltip.Provider>
  );
}

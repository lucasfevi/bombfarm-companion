'use client';

import { useCallback, useMemo, useState } from 'react';
import { rankSkillGains, wikiGateLines, gateWindowSecs, PVP_WINDOW_SECS, type SkillNode, type SkillNodeGain, type SkillPricingObjective } from '@bombfarm/domain/skill-tree';
import { FactTile, Panel, PanelHeader, SearchSelect, SegmentedToggle, Tooltip, cn, tipClass, type SearchSelectOption } from '@bombfarm/ui';
import { NextToBuyPanel, type RecommendationRow } from './next-to-buy-panel';
import { objectiveDelta, statusMap, treeSummary } from './node-facts';
import { skillNodeDisplayName } from './node-name';
import { SelectedNodeCard } from './selected-node-card';
import { SkillTreeCanvas, SkillTreeLegend } from './skill-tree-canvas';
import { TotalsPanel } from './totals-panel';
import type { SkillTreeLabels, SkillTreeScreenProps } from './types';

export const DEFAULT_RECOMMENDATION_COUNT = 5;

const OBJECTIVES: readonly SkillPricingObjective[] = ['goldPerHour', 'gateClear', 'pvp'];

function isObjective(id: string): id is SkillPricingObjective {
  return (OBJECTIVES as readonly string[]).includes(id);
}

function objectiveLabel(objective: SkillPricingObjective, labels: SkillTreeLabels): string {
  switch (objective) {
    case 'goldPerHour':
      return labels.objectiveGold;
    case 'gateClear':
      return labels.objectiveGate;
    default:
      return labels.objectivePvp;
  }
}

export function SkillTreeScreen({
  catalog,
  layout,
  state,
  totals,
  pricing,
  objective,
  onObjectiveChange,
  objectives = OBJECTIVES,
  gatePhase,
  onGatePhaseChange,
  pvpEmpty = false,
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

  const gateOptions = useMemo<SearchSelectOption[]>(
    () => wikiGateLines().map((line) => ({ value: String(line.phase), label: labels.gatePhaseOption(line.phase) })),
    [labels],
  );
  const hideRanking = objective === 'pvp' && pvpEmpty;
  const recommendations = useMemo<RecommendationRow[]>(() => {
    if (!pricing || hideRanking) return [];
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
  }, [pricing, objective, recommendationCount, nodeById, statuses, hideRanking]);
  const recommendedId = recommendations[0]?.node.id ?? null;

  const selectedNode = selectedId === null ? null : (nodeById.get(selectedId) ?? null);
  const selectedStatus = selectedNode ? (statuses.get(selectedNode.id) ?? null) : null;
  const selectedGain = selectedNode ? (gains.get(selectedNode.id) ?? null) : null;
  const pricedAt = (() => {
    if (!pricing) return null;
    if (objective === 'goldPerHour') return labels.pricedAtPhase(pricing.phase);
    if (objective === 'gateClear') return labels.pricedAtGate(gatePhase, gateWindowSecs(gatePhase));
    if (pricing.combatPhase == null) return null;
    return labels.pricedAtPvp(pricing.combatPhase, PVP_WINDOW_SECS);
  })();

  return (
    <Tooltip.Provider delay={180}>
      <div
        data-testid="skill-tree-screen"
        className={cn(
          'grid',
          'min-h-0',
          'min-w-0',
          'flex-1',
          'grid-cols-1',
          'items-stretch',
          'gap-2.5',
          'min-[960px]:grid-cols-[minmax(0,1fr)_minmax(22rem,24rem)]',
          'min-[960px]:grid-rows-[minmax(0,1fr)]',
          className,
        )}
      >
        <Panel className="flex min-h-0 min-w-0 flex-col" data-testid="skill-tree-canvas-panel">
          <PanelHeader title={labels.title} />
          <p className={tipClass}>{labels.tip}</p>
          <div className="relative flex min-h-0 flex-1 flex-col">
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
            {selectedNode && selectedStatus ? (
              <SelectedNodeCard
                node={selectedNode}
                status={selectedStatus}
                gain={selectedGain}
                pricing={pricing}
                nodeById={nodeById}
                statuses={statuses}
                nodeArtSrc={nodeArtSrc}
                nodeName={nodeName}
                onSelect={select}
                labels={labels}
                className="absolute top-12 right-2 max-h-[calc(100%-3.5rem)] w-80 max-w-[calc(100%-1rem)] overflow-y-auto"
              />
            ) : null}
          </div>
          <div className="mt-2">
            <SkillTreeLegend labels={labels} />
          </div>
        </Panel>

        <div className="flex min-h-0 min-w-0 flex-col gap-2.5 min-[960px]:overflow-y-auto min-[960px]:pr-0.5">
          <Panel data-testid="skill-tree-header">
            <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
              <FactTile size="headline" label={labels.wallet} value={state.gold === null ? '—' : labels.gold(state.gold)} valueClassName="text-gold" data-testid="skill-tree-wallet" />
              {pricedAt ? (
                <p className={cn('m-0', 'text-[11px]', 'text-muted')} data-testid="skill-tree-priced-at">
                  {pricedAt}
                </p>
              ) : null}
              <div className={cn('flex', 'flex-wrap', 'items-end', 'gap-2')}>
                <SegmentedToggle
                  ariaLabel={labels.nextToBuy}
                  value={objective}
                  onChange={(id) => {
                    if (isObjective(id)) onObjectiveChange(id);
                  }}
                  options={objectives.map((id) => ({ id, label: objectiveLabel(id, labels) }))}
                />
                {objective === 'gateClear' ? (
                  <div data-testid="skill-tree-gate-phase" className="w-52">
                    <SearchSelect
                      aria-label={labels.gatePhaseSelect}
                      options={gateOptions}
                      value={String(gatePhase)}
                      onValueChange={(next) => {
                        const phase = Number.parseInt(next, 10);
                        if (Number.isFinite(phase)) onGatePhaseChange(phase);
                      }}
                      searchPlaceholder={labels.gatePhaseSearchPlaceholder}
                      emptyLabel={labels.gatePhaseNoMatch}
                      overflowLabel={labels.gatePhaseMoreMatches}
                      className={cn('h-8', 'min-h-8')}
                    />
                  </div>
                ) : null}
              </div>
            </div>
          </Panel>

          <NextToBuyPanel
            pricing={pricing}
            rows={recommendations}
            objective={objective}
            pvpEmpty={hideRanking}
            selectedId={selectedId}
            onSelect={select}
            nodeArtSrc={nodeArtSrc}
            nodeName={nodeName}
            labels={labels}
          />

          <TotalsPanel totals={totals} summary={summary} labels={labels} />
        </div>
      </div>
    </Tooltip.Provider>
  );
}

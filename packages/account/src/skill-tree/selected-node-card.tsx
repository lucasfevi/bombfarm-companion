import {
  costForLevels,
  type SkillNode,
  type SkillNodeGain,
  type SkillNodeStatus,
  type SkillTreePricing,
} from '@bombfarm/domain/skill-tree';
import { Panel, PanelHeader, StatList, cn, heroAbilTitleClass, tipClass, type StatListItem } from '@bombfarm/ui';
import { effectTotalAt, formatEffectTotal } from './node-facts';
import type { SkillTreeLabels } from './types';

export type SelectedNodeCardProps = {
  node: SkillNode | null;
  status: SkillNodeStatus | null;
  gain: SkillNodeGain | null;
  pricing: SkillTreePricing | null;
  nodeArtSrc: (node: SkillNode) => string | null;
  nodeName: (node: SkillNode) => string;
  parentName: (id: string) => string;
  labels: SkillTreeLabels;
};

function stateLine(node: SkillNode, status: SkillNodeStatus, parentName: (id: string) => string, labels: SkillTreeLabels): string {
  switch (status.availability) {
    case 'lit':
      return labels.alwaysLit;
    case 'maxed':
      return labels.stateMaxed;
    case 'lockedPhase':
      return labels.stateLockedPhase(node.gatePhase);
    case 'lockedPrerequisite': {
      const [missing] = status.missing;
      return missing ? labels.stateLockedPrerequisite(parentName(missing.id), missing.need, missing.have) : labels.stateBuyable;
    }
    default:
      if (status.affordable === false) return labels.stateUnaffordable;
      return status.owned ? labels.stateOwned : labels.stateBuyable;
  }
}

function rateGold(labels: SkillTreeLabels, value: number): string {
  return labels.goldPerHour ? labels.goldPerHour(value) : labels.goldCompact(value);
}

function rateDps(labels: SkillTreeLabels, value: number): string {
  return labels.teamDps ? labels.teamDps(value) : String(Math.round(value));
}

function Delta({ value, text }: { value: number; text: string }) {
  return <span className={cn('ml-1.5 font-mono text-[11px]', value < 0 ? 'text-down' : 'text-up')}>{text}</span>;
}

export function SelectedNodeCard({ node, status, gain, pricing, nodeArtSrc, nodeName, parentName, labels }: SelectedNodeCardProps) {
  if (node === null || status === null) {
    return (
      <Panel data-testid="skill-tree-selected">
        <p className="m-0 text-xs text-muted">{labels.selectNodeHint}</p>
      </Panel>
    );
  }

  const art = nodeArtSrc(node);
  const nextLevel = Math.min(node.maxLevel, status.level + 1);
  const effectItems: StatListItem[] = node.effects.map((effect) => ({
    id: effect.kind,
    label: labels.effectPerLevel(effect.kind, effect.perLevel),
    value: labels.totalNowNext(
      formatEffectTotal(effect.kind, effectTotalAt(effect, status.level)),
      formatEffectTotal(effect.kind, effectTotalAt(effect, nextLevel)),
    ),
  }));

  const costItems: StatListItem[] = [];
  if (status.nextCost !== null) {
    costItems.push({ id: 'next-cost', label: labels.nextLevelCost, value: labels.gold(status.nextCost) });
  }
  if (status.level < node.maxLevel && node.tier !== 'start') {
    costItems.push({ id: 'cost-to-max', label: labels.costToMax, value: labels.gold(costForLevels(node, status.level, node.maxLevel)) });
  }
  if (status.refund !== null) {
    const blocked = status.refundBlockedBy.length > 0;
    costItems.push({
      id: 'refund',
      label: labels.refund,
      value: labels.gold(status.refund),
      muted: blocked,
      ...(blocked ? { tip: labels.refundBlocked(status.refundBlockedBy.map(parentName).join(', ')) } : {}),
    });
  }
  const [parentId] = node.requires;
  if (parentId !== undefined) {
    costItems.push({ id: 'requires', label: labels.requires, value: parentName(parentId) });
  }
  if (node.gatePhase > 0) {
    costItems.push({ id: 'gate', label: labels.gate, value: String(node.gatePhase) });
  }

  const showPreview = status.availability === 'buyable' && gain !== null && pricing !== null;

  return (
    <Panel data-testid="skill-tree-selected" data-node-id={node.id}>
      <div className="flex items-center gap-3">
        {art === null ? (
          <span aria-hidden className="size-12 shrink-0 rounded-full border border-line bg-bg-2" />
        ) : (
          <img alt="" src={art} className="size-12 shrink-0 rounded-full object-cover" />
        )}
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 className="m-0 truncate text-sm font-bold text-ink">{nodeName(node)}</h2>
          <p className="m-0 text-[11px] text-muted">
            {labels.armName(node.arm)} · {labels.tierName(node.tier)}
          </p>
          <p className="m-0 font-mono text-[11px] text-ink" data-testid="skill-tree-selected-level">
            {labels.level(status.level, status.maxLevel)}
          </p>
        </div>
      </div>
      {node.tier === 'start' ? <p className={cn(tipClass, 'mt-2')}>{labels.hubNote}</p> : null}
      <p className="m-0 mt-2 text-xs text-ink" data-testid="skill-tree-selected-state">
        {stateLine(node, status, parentName, labels)}
      </p>

      <h3 className={heroAbilTitleClass}>{labels.effects}</h3>
      <StatList variant="phases" items={effectItems} aria-label={labels.effects} />

      {costItems.length > 0 ? <StatList variant="phases" className="mt-2 border-t border-line pt-2" items={costItems} aria-label={labels.nextLevelCost} /> : null}

      {showPreview ? (
        <div className="mt-3 border-t border-line pt-3" data-testid="skill-tree-preview">
          <PanelHeader title={labels.preview} className="mb-1" />
          <p className={tipClass}>{labels.previewTip}</p>
          <StatList
            variant="phases"
            aria-label={labels.preview}
            items={[
              {
                id: 'preview-gold',
                label: labels.previewGold,
                value: (
                  <>
                    {labels.totalNowNext(
                      rateGold(labels, pricing.baseline.goldPerHour),
                      rateGold(labels, pricing.baseline.goldPerHour + gain.goldPerHourDelta),
                    )}
                    <Delta value={gain.goldPerHourDelta} text={labels.gainGold(gain.goldPerHourDelta)} />
                  </>
                ),
              },
              { id: 'per-million-gold', label: labels.colPerMillion, value: labels.perMillionGold(gain.goldPerMillion) },
              ...(pricing.baseline.teamDps !== null && gain.teamDpsDelta !== null && gain.dpsPerMillion !== null
                ? [
                    {
                      id: 'preview-dps',
                      label: labels.previewDps,
                      value: (
                        <>
                          {labels.totalNowNext(
                            rateDps(labels, pricing.baseline.teamDps),
                            rateDps(labels, pricing.baseline.teamDps + gain.teamDpsDelta),
                          )}
                          <Delta value={gain.teamDpsDelta} text={labels.gainDps(gain.teamDpsDelta)} />
                        </>
                      ),
                    },
                    { id: 'per-million-dps', label: labels.colPerMillion, value: labels.perMillionDps(gain.dpsPerMillion) },
                  ]
                : []),
            ]}
          />
          {gain.unpriced.length > 0 ? (
            <p className="m-0 mt-2 text-[11px] text-muted" data-testid="skill-tree-preview-unpriced">
              {labels.gainOutsideObjectives}
            </p>
          ) : null}
        </div>
      ) : null}
    </Panel>
  );
}

import {
  costForLevels,
  type SkillNode,
  type SkillNodeGain,
  type SkillNodeStatus,
  type SkillCombatFigure,
  type SkillTreePricing,
} from '@bombfarm/domain/skill-tree';
import { GoldValue } from '@bombfarm/game-art';
import {
  Button,
  Icon,
  InfoTip,
  StatList,
  Tooltip,
  cn,
  heroAbilTitleClass,
  tipClass,
  type StatListItem,
} from '@bombfarm/ui';
import { AffordableCheck, ShortOfGoldMark } from './affordable-check';
import { CompactFigure } from './compact-figure';
import { effectTotalAt } from './node-facts';
import type { SkillTreeLabels } from './types';

export type SelectedNodeCardProps = {
  node: SkillNode;
  status: SkillNodeStatus;
  gain: SkillNodeGain | null;
  pricing: SkillTreePricing | null;
  nodeById: ReadonlyMap<string, SkillNode>;
  statuses: ReadonlyMap<string, SkillNodeStatus>;
  nodeArtSrc: (node: SkillNode) => string | null;
  nodeName: (node: SkillNode) => string;
  onSelect: (id: string | null) => void;
  labels: SkillTreeLabels;
  className?: string;
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

function Medallion({ src, className }: { src: string | null; className: string }) {
  if (src === null) return <span aria-hidden className={cn('shrink-0 rounded-full border border-line bg-bg-2', className)} />;
  return <img alt="" src={src} className={cn('shrink-0 rounded-full object-cover', className)} />;
}

/** The prerequisite as a node to reach: its medallion and name, a hover card, a click that selects it. */
function RequiredNode({
  node,
  status,
  art,
  name,
  onSelect,
  labels,
}: {
  node: SkillNode;
  status: SkillNodeStatus | undefined;
  art: string | null;
  name: string;
  onSelect: (id: string) => void;
  labels: SkillTreeLabels;
}) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger
        delay={180}
        closeDelay={80}
        render={
          <button
            type="button"
            data-testid={`skill-tree-requires-${node.id}`}
            onClick={() => onSelect(node.id)}
            className="inline-flex max-w-full cursor-pointer items-center gap-1.5 rounded-sm border border-transparent px-1 py-0.5 font-mono text-[11px] text-ink hover:border-line hover:bg-bg-2"
          />
        }
      >
        <Medallion src={art} className="size-4" />
        <span className="truncate">{name}</span>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Positioner sideOffset={6}>
          <Tooltip.Popup>
            <p className="m-0 text-xs font-semibold text-ink">{name}</p>
            {status ? (
              <p className="m-0 text-[11px] text-muted">
                {labels.armName(node.arm)} · {labels.level(status.level, status.maxLevel)}
              </p>
            ) : null}
            {node.effects.map((effect) => (
              <p key={effect.kind} className="m-0 text-[11px]">
                {labels.effectPerLevel(effect.kind, effect.perLevel)}
              </p>
            ))}
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

export function SelectedNodeCard({
  node,
  status,
  gain,
  pricing,
  nodeById,
  statuses,
  nodeArtSrc,
  nodeName,
  onSelect,
  labels,
  className,
}: SelectedNodeCardProps) {
  const parentName = (id: string) => {
    const parent = nodeById.get(id);
    return parent ? nodeName(parent) : id;
  };
  const gold = (amount: number) => (
    <GoldValue baseline>
      <CompactFigure compact={labels.goldCompact(amount)} exact={labels.gold(amount)} />
    </GoldValue>
  );
  const dps = (value: number) => <CompactFigure compact={labels.compactNumber(value)} exact={rateDps(labels, value)} />;
  const combatRows = (
    id: string,
    figure: SkillCombatFigure | null,
    delta: number | null,
    perMillion: number | null,
    title: (phase: number) => string,
  ): StatListItem[] => {
    if (figure === null || figure.dps === null || delta === null || perMillion === null) return [];
    const before = figure.dps;
    return [
      {
        id: `preview-${id}`,
        label: title(figure.phase),
        value: (
          <>
            {dps(before)}
            <span className="mx-1">→</span>
            {dps(before + delta)}
            <Delta value={delta} text={labels.gainDps(delta)} />
          </>
        ),
      },
      { id: `per-million-${id}`, label: labels.colPerMillion, value: labels.perMillionDps(perMillion) },
    ];
  };

  const nextLevel = Math.min(node.maxLevel, status.level + 1);
  const effectItems: StatListItem[] = node.effects.map((effect) => ({
    id: effect.kind,
    label: labels.effectPerLevel(effect.kind, effect.perLevel),
    value: labels.totalNowNext(
      labels.effectValue(effect.kind, effectTotalAt(effect, status.level)),
      labels.effectValue(effect.kind, effectTotalAt(effect, nextLevel)),
    ),
  }));

  const costItems: StatListItem[] = [];
  if (status.nextCost !== null) {
    costItems.push({ id: 'next-cost', label: labels.nextLevelCost, value: gold(status.nextCost) });
  }
  if (status.level < node.maxLevel && node.tier !== 'start') {
    costItems.push({ id: 'cost-to-max', label: labels.costToMax, value: gold(costForLevels(node, status.level, node.maxLevel)) });
  }
  if (status.refund !== null) {
    const blocked = status.refundBlockedBy.length > 0;
    costItems.push({
      id: 'refund',
      label: labels.refund,
      value: gold(status.refund),
      muted: blocked,
      tip: blocked ? labels.refundBlocked(status.refundBlockedBy.map(parentName).join(', ')) : labels.refundTip,
    });
  }
  const [parentId] = node.requires;
  const parent = parentId === undefined ? undefined : nodeById.get(parentId);
  if (parent) {
    costItems.push({
      id: 'requires',
      label: labels.requires,
      value: (
        <RequiredNode
          node={parent}
          status={statuses.get(parent.id)}
          art={nodeArtSrc(parent)}
          name={nodeName(parent)}
          onSelect={onSelect}
          labels={labels}
        />
      ),
    });
  }
  if (node.gatePhase > 0) {
    costItems.push({ id: 'gate', label: labels.gate, value: String(node.gatePhase) });
  }

  const showPreview = status.availability === 'buyable' && gain !== null && pricing !== null;

  return (
    <section
      data-testid="skill-tree-selected"
      data-node-id={node.id}
      aria-label={nodeName(node)}
      className={cn('relative flex flex-col rounded-sm border border-line bg-surface p-3 shadow-lg', className)}
    >
      <span className="absolute top-1.5 right-1.5">
        <Button variant="icon" aria-label={labels.closeNode} data-testid="skill-tree-selected-close" onClick={() => onSelect(null)}>
          <Icon name="x-mark" size="sm" />
        </Button>
      </span>
      <div className="flex items-start gap-3 pr-5">
        <Medallion src={nodeArtSrc(node)} className="size-12" />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h2 className="m-0 flex items-center gap-1.5 truncate text-sm font-bold text-ink">
            <span className="truncate">{nodeName(node)}</span>
            {status.affordable === true ? (
              <AffordableCheck label={labels.affordableNow} testId={`skill-tree-selected-affordable-${node.id}`} />
            ) : status.affordable === false ? (
              <ShortOfGoldMark label={labels.stateUnaffordable} testId={`skill-tree-selected-short-${node.id}`} />
            ) : null}
          </h2>
          <p className="m-0 text-[11px] text-muted">
            {labels.armName(node.arm)} · {labels.tierName(node.tier)}
          </p>
          <p className="m-0 font-mono text-[11px] text-ink" data-testid="skill-tree-selected-level">
            {labels.level(status.level, status.maxLevel)}
          </p>
        </div>
      </div>
      {node.tier === 'start' ? <p className={cn(tipClass, 'mt-2')}>{labels.hubNote}</p> : null}
      {status.availability === 'buyable' ? null : (
        <p className="m-0 mt-2 text-xs text-ink" data-testid="skill-tree-selected-state">
          {stateLine(node, status, parentName, labels)}
        </p>
      )}

      <h3 className={heroAbilTitleClass}>{labels.effects}</h3>
      <StatList variant="phases" items={effectItems} aria-label={labels.effects} />

      {costItems.length > 0 ? <StatList variant="phases" className="mt-2 border-t border-line pt-2" items={costItems} aria-label={labels.nextLevelCost} /> : null}

      {showPreview ? (
        <div className="mt-3 border-t border-line pt-3" data-testid="skill-tree-preview">
          <h3 className={cn(heroAbilTitleClass, 'flex items-center gap-1.5')}>
            {labels.preview}
            <InfoTip label={labels.preview} tip={labels.previewTip} />
          </h3>
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
              {
                id: 'preview-gold-at-roster',
                label: labels.previewGoldAtRoster,
                value: (
                  <>
                    {labels.totalNowNext(
                      rateGold(labels, pricing.baseline.goldPerHour),
                      rateGold(labels, pricing.baseline.goldPerHour + gain.goldPerHourDeltaAtRoster),
                    )}
                    <Delta value={gain.goldPerHourDeltaAtRoster} text={labels.gainGold(gain.goldPerHourDeltaAtRoster)} />
                  </>
                ),
              },
              { id: 'per-million-gold', label: labels.colPerMillion, value: labels.perMillionGold(gain.goldPerMillion) },
              ...combatRows('gate', pricing.baseline.gate, gain.gateDpsDelta, gain.gatePerMillion, labels.previewGate),
              ...combatRows('pvp', pricing.baseline.pvp, gain.pvpDpsDelta, gain.pvpPerMillion, labels.previewPvp),
            ]}
          />
          {gain.unpriced.length > 0 ? (
            <p className="m-0 mt-2 text-[11px] text-muted" data-testid="skill-tree-preview-unpriced">
              {labels.gainOutsideObjectives}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

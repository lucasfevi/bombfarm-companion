import type { SkillNode, SkillNodeGain, SkillNodeStatus, SkillPricingObjective, SkillTreePricing } from '@bombfarm/domain/skill-tree';
import { Panel, PanelHeader, cn, tipClass } from '@bombfarm/ui';
import { AffordableCheck } from './affordable-check';
import { effectTotalAt, objectiveDelta, objectivePerMillion } from './node-facts';
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
  pvpEmpty?: boolean;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  nodeArtSrc: (node: SkillNode) => string | null;
  nodeName: (node: SkillNode) => string;
  labels: SkillTreeLabels;
};

const factLabelClass = 'm-0 text-[10px] font-bold tracking-[0.08em] text-muted uppercase';
const factValueClass = 'mt-px block font-mono text-[11px] font-bold tabular-nums';

function Medallion({ node, src, className }: { node: SkillNode; src: string | null; className?: string }) {
  if (src === null) return <span aria-hidden className={cn('inline-block', 'shrink-0', 'rounded-full', 'border', 'border-line', 'bg-bg-2', className)} />;
  return <img alt="" src={src} data-node-art={node.id} className={cn('shrink-0', 'rounded-full', 'object-cover', className)} />;
}

function rateGold(labels: SkillTreeLabels, value: number): string {
  return labels.goldPerHour ? labels.goldPerHour(value) : labels.goldCompact(value);
}

function rateDps(labels: SkillTreeLabels, value: number): string {
  return labels.teamDps ? labels.teamDps(value) : String(Math.round(value));
}

type ObjectiveFigure = { title: string; before: string; after: string; change: string; tone: 'up' | 'down' };

/** The objective's figure as it stands and with the node — gold/hr, or the window's damage per second. */
function objectiveFigure(
  pricing: SkillTreePricing,
  gain: SkillNodeGain,
  objective: SkillPricingObjective,
  labels: SkillTreeLabels,
): ObjectiveFigure | null {
  if (objective === 'goldPerHour') {
    const before = pricing.baseline.goldPerHour;
    const after = before + gain.goldPerHourDelta;
    return {
      title: labels.previewGold,
      before: rateGold(labels, before),
      after: rateGold(labels, after),
      change: labels.percentChange(before > 0 ? after / before - 1 : 0),
      tone: gain.goldPerHourDelta < 0 ? 'down' : 'up',
    };
  }
  if (pricing.baseline.teamDps === null || gain.teamDpsDelta === null) return null;
  const before = pricing.baseline.teamDps;
  const after = before + gain.teamDpsDelta;
  return {
    title: objective === 'pvp' ? labels.previewPvp : labels.previewGate,
    before: rateDps(labels, before),
    after: rateDps(labels, after),
    change: labels.percentChange(before > 0 ? after / before - 1 : 0),
    tone: gain.teamDpsDelta < 0 ? 'down' : 'up',
  };
}

const beforeAfterRowClass = 'flex items-baseline justify-between gap-2 text-[11px]';

function BeforeAfter({
  title,
  before,
  after,
  change,
  changeTone = 'up',
  labels,
}: {
  title: string;
  before: string;
  after: string;
  change: string;
  changeTone?: 'up' | 'down';
  labels: SkillTreeLabels;
}) {
  return (
    <span className={cn('flex', 'flex-col', 'gap-0.5', 'not-first:mt-2')}>
      <span className={factLabelClass}>{title}</span>
      <span className={beforeAfterRowClass}>
        <span className="text-muted">{labels.before}</span>
        <span className={cn('font-mono', 'tabular-nums')}>{before}</span>
      </span>
      <span className={beforeAfterRowClass}>
        <span className="text-muted">{labels.after}</span>
        <span className={cn('font-mono', 'font-bold', 'tabular-nums')}>{after}</span>
      </span>
      <span className={beforeAfterRowClass}>
        <span className="text-muted">{labels.change}</span>
        <span className={cn('font-mono', 'font-bold', 'tabular-nums', changeTone === 'down' ? 'text-down' : 'text-up')}>{change}</span>
      </span>
    </span>
  );
}

function NextToBuyRow({
  node,
  gain,
  status,
  pricing,
  objective,
  selected,
  onSelect,
  nodeArtSrc,
  nodeName,
  labels,
}: {
  node: SkillNode;
  gain: SkillNodeGain;
  status: SkillNodeStatus;
  pricing: SkillTreePricing;
  objective: SkillPricingObjective;
  selected: boolean;
  onSelect: (id: string | null) => void;
  nodeArtSrc: (node: SkillNode) => string | null;
  nodeName: (node: SkillNode) => string;
  labels: SkillTreeLabels;
}) {
  const delta = objectiveDelta(gain, objective) ?? 0;
  const perMillion = objectivePerMillion(gain, objective) ?? 0;
  const gainLabel = objective === 'goldPerHour' ? labels.gainGold : labels.gainDps;
  const perMillionLabel = objective === 'goldPerHour' ? labels.perMillionGold : labels.perMillionDps;
  const figure = objectiveFigure(pricing, gain, objective, labels);
  const nextLevel = Math.min(node.maxLevel, gain.level + 1);
  const buyable = status.affordable === true;

  return (
    <li>
      <button
        type="button"
        data-testid={`skill-tree-recommendation-${node.id}`}
        data-node-id={node.id}
        aria-pressed={selected}
        onClick={() => onSelect(selected ? null : node.id)}
        className={cn(
          'w-full',
          'cursor-pointer',
          'rounded-sm',
          'border',
          'px-3',
          'py-2.5',
          'text-left',
          'text-xs',
          'text-ink',
          'motion-safe:transition-[border-color,background-color,box-shadow]',
          'motion-safe:duration-[120ms]',
          selected ? 'border-accent' : 'border-transparent',
          selected ? 'bg-[color-mix(in_oklch,var(--accent)_10%,var(--surface))]' : 'hover:bg-bg-2',
          !selected && 'hover:border-line',
          buyable && 'border-[color-mix(in_oklch,var(--up)_45%,var(--line))]',
          buyable && 'shadow-[inset_3px_0_0_var(--up)]',
          buyable && selected && 'border-accent',
        )}
      >
        <span className={cn('flex', 'items-center', 'justify-between', 'gap-3')}>
          <span className={cn('min-w-0', 'flex-1')}>
            <span className={cn('flex', 'min-w-0', 'items-center', 'gap-2.5')}>
              <Medallion node={node} src={nodeArtSrc(node)} className="size-6" />
              <span className={cn('flex', 'min-w-0', 'flex-col')}>
                <span className={cn('flex', 'items-center', 'gap-1.5', 'font-semibold')}>
                  {nodeName(node)}
                  {buyable ? <AffordableCheck label={labels.affordableNow} testId={`skill-tree-affordable-${node.id}`} /> : null}
                </span>
                <span className={cn('font-mono', 'text-[10px]', 'text-muted', 'tabular-nums')}>
                  {labels.totalNowNext(String(gain.level), String(gain.level + 1))}
                </span>
              </span>
            </span>
            <span className={cn('mt-2', 'flex', 'gap-3.5', 'pl-[34px]')}>
              <span>
                <span className={factLabelClass}>{labels.colCost}</span>
                <span className={cn(factValueClass, 'text-gold')}>{labels.goldCompact(gain.cost)}</span>
              </span>
              <span>
                <span className={factLabelClass}>{labels.colGain}</span>
                <span className={cn(factValueClass, delta < 0 ? 'text-down' : 'text-up')}>{gainLabel(delta)}</span>
              </span>
            </span>
          </span>
          <span className={cn('shrink-0', 'text-right', 'leading-none')}>
            <span
              className={cn(
                'block',
                'font-mono',
                'text-2xl',
                'font-bold',
                'tabular-nums',
                objective === 'goldPerHour' ? 'text-gold' : 'text-ink',
              )}
            >
              {perMillionLabel(perMillion)}
            </span>
            <span className={cn('mt-0.5', 'block', 'text-[10px]', 'text-muted')}>{labels.colPerMillion}</span>
          </span>
        </span>
        {selected ? (
          <span
            className={cn('mt-2.5', 'grid', 'grid-cols-2', 'gap-3', 'border-t', 'border-line', 'pt-2.5')}
            data-testid={`skill-tree-recommendation-detail-${node.id}`}
          >
            <span>
              {node.effects.map((effect) => {
                const before = effectTotalAt(effect, gain.level);
                const after = effectTotalAt(effect, nextLevel);
                return (
                  <BeforeAfter
                    key={effect.kind}
                    title={labels.kindName(effect.kind)}
                    before={labels.effectValue(effect.kind, before)}
                    after={labels.effectValue(effect.kind, after)}
                    change={labels.effectValue(effect.kind, after - before)}
                    labels={labels}
                  />
                );
              })}
            </span>
            <span className={cn('border-l', 'border-line', 'pl-3')}>
              {figure ? (
                <BeforeAfter
                  title={figure.title}
                  before={figure.before}
                  after={figure.after}
                  change={figure.change}
                  changeTone={figure.tone}
                  labels={labels}
                />
              ) : null}
            </span>
          </span>
        ) : null}
      </button>
    </li>
  );
}

export function NextToBuyPanel({ pricing, rows, objective, pvpEmpty = false, selectedId, onSelect, nodeArtSrc, nodeName, labels }: NextToBuyPanelProps) {
  return (
    <Panel data-testid="skill-tree-next-to-buy">
      <PanelHeader title={labels.nextToBuy} />
      <p className={tipClass}>{labels.nextToBuyTip}</p>
      {pricing === null ? (
        <p className="m-0 text-xs text-muted" role="status">
          {labels.pricingUnavailable}
        </p>
      ) : pvpEmpty ? (
        <p className="m-0 text-xs text-muted" role="status" data-testid="skill-tree-pvp-empty">
          {labels.pvpEmpty}
        </p>
      ) : rows.length === 0 ? (
        <p className="m-0 text-xs text-muted" role="status">
          {labels.nothingToRecommend}
        </p>
      ) : (
        <ol className={cn('m-0', 'flex', 'list-none', 'flex-col', 'gap-1.5', 'p-0')} aria-label={labels.nextToBuy}>
          {rows.map(({ node, gain, status }) => (
            <NextToBuyRow
              key={node.id}
              node={node}
              gain={gain}
              status={status}
              pricing={pricing}
              objective={objective}
              selected={selectedId === node.id}
              onSelect={onSelect}
              nodeArtSrc={nodeArtSrc}
              nodeName={nodeName}
              labels={labels}
            />
          ))}
        </ol>
      )}
      {pricing !== null && pricing.dpsLeftOut.length > 0 ? (
        <p className="m-0 mt-2 text-[11px] text-warn" data-testid="skill-tree-dps-left-out">
          {labels.dpsLeftOut(pricing.dpsLeftOut.join(', '))}
        </p>
      ) : null}
    </Panel>
  );
}

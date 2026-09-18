import type { CSSProperties } from 'react';
import type { SkillArm } from '@bombfarm/domain/skill-tree';
import { GoldValue } from '@bombfarm/game-art';
import { cn } from '@bombfarm/ui';
import { skillArmColour } from './arm-colour';
import type { ArmSummary } from './node-facts';
import type { SkillTreeLabels } from './types';

export type PathProgressCardsProps = {
  summaries: readonly ArmSummary[];
  focusArm: SkillArm | null;
  onFocusArm: (arm: SkillArm | null) => void;
  labels: SkillTreeLabels;
};

function share(part: number, whole: number): number {
  return whole > 0 ? part / whole : 0;
}

/**
 * One card per path above the tree; pressing one lights that path alone on the canvas. The card
 * is the button, so the spent figure carries its exact value as its accessible name rather than
 * in a hover — a tooltip trigger would be a second focus stop inside the first.
 */
export function PathProgressCards({ summaries, focusArm, onFocusArm, labels }: PathProgressCardsProps) {
  return (
    <div
      role="group"
      aria-label={labels.paths}
      data-testid="skill-tree-paths"
      className={cn('mb-2', 'grid', 'grid-cols-2', 'gap-1.5', 'min-[720px]:grid-cols-4')}
    >
      {summaries.map((summary) => {
        const colour = skillArmColour(summary.arm);
        const pressed = focusArm === summary.arm;
        const fraction = share(summary.ownedLevels, summary.totalLevels);
        const pathGold = summary.goldSpent + summary.goldToMax;
        const goldFraction = share(summary.goldSpent, pathGold);
        return (
          <button
            key={summary.arm}
            type="button"
            aria-pressed={pressed}
            data-testid={`skill-tree-path-${summary.arm}`}
            data-arm={summary.arm}
            onClick={() => onFocusArm(pressed ? null : summary.arm)}
            style={{ '--path-colour': colour } as CSSProperties}
            className={cn(
              'grid',
              'min-w-0',
              'gap-1',
              'rounded-md',
              'border',
              'bg-bg-2',
              'px-2.5',
              'py-1.5',
              'text-left',
              'text-[11px]',
              'outline-none',
              'transition-colors',
              'focus-visible:ring-2',
              'focus-visible:ring-accent',
              pressed ? 'border-[var(--path-colour)]' : 'border-line',
              pressed ? 'bg-[color-mix(in_oklch,var(--path-colour)_9%,var(--bg-2))]' : 'hover:border-[color-mix(in_oklch,var(--path-colour)_55%,var(--line))]',
            )}
          >
            <span className={cn('flex', 'items-baseline', 'justify-between', 'gap-1.5', 'min-w-0')}>
              <span className={cn('flex', 'min-w-0', 'items-center', 'gap-1.5', 'truncate', 'text-xs', 'font-medium', 'text-ink')}>
                <span
                  aria-hidden
                  className={cn('inline-block', 'size-2', 'shrink-0', 'rounded-full', 'bg-[var(--path-colour)]')}
                  style={{ boxShadow: `0 0 6px color-mix(in oklch, ${colour} 60%, transparent)` }}
                />
                {labels.armName(summary.arm)}
              </span>
              <span className={cn('shrink-0', 'font-mono', 'text-muted')} data-testid={`skill-tree-path-levels-${summary.arm}`}>
                <span className="text-ink">{labels.countOf(summary.ownedLevels, summary.totalLevels)}</span>
                {fraction < 1 ? <span className="ml-1">{labels.share(fraction)}</span> : null}
              </span>
            </span>
            <span
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={summary.totalLevels}
              aria-valuenow={summary.ownedLevels}
              aria-label={labels.levelsBought}
              className={cn('block', 'h-1', 'overflow-hidden', 'rounded-sm', 'bg-[color-mix(in_oklch,var(--line)_70%,var(--bg))]')}
            >
              <span className={cn('block', 'h-full', 'rounded-sm', 'bg-[var(--path-colour)]')} style={{ width: `${(fraction * 100).toFixed(1)}%` }} />
            </span>
            <span className="text-muted">{labels.nodesMaxed(summary.maxedNodes, summary.nodes)}</span>
            <span className={cn('flex', 'justify-between', 'gap-1.5', 'text-muted')}>
              <span>{labels.goldSpent}</span>
              <GoldValue className="font-mono" iconClassName="size-3">
                <span
                  aria-label={`${labels.goldSpent}: ${labels.gold(summary.goldSpent)} / ${labels.gold(pathGold)}`}
                  data-testid={`skill-tree-path-spent-${summary.arm}`}
                >
                  <span className="text-gold">{labels.goldCompact(summary.goldSpent)}</span>
                  <span className="text-muted"> / {labels.goldCompact(pathGold)}</span>
                  {goldFraction < 1 ? <span className="ml-1">{labels.share(goldFraction)}</span> : null}
                </span>
              </GoldValue>
            </span>
          </button>
        );
      })}
    </div>
  );
}

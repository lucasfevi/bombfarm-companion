import { rosterIconTooltipTriggerClass } from '@bombfarm/game-art';
import { Tooltip, cn } from '@bombfarm/ui';

/** A figure printed short, with the exact number a hover away — the team-plan convention. */
export function CompactFigure({ compact, exact, className }: { compact: string; exact: string; className?: string }) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger render={<span />} className={cn(rosterIconTooltipTriggerClass, className)}>
        {compact}
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Positioner sideOffset={6}>
          <Tooltip.Popup>
            <p className="m-0 font-mono">{exact}</p>
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

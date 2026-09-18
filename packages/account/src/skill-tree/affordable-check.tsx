import type { ReactNode } from 'react';
import { goldIconSrc } from '@bombfarm/domain/wiki-assets';
import { Icon, Tooltip, cn } from '@bombfarm/ui';

function Mark({ label, testId, children }: { label: string; testId: string; children: ReactNode }) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger
        delay={180}
        closeDelay={80}
        render={<span className={cn('inline-flex', 'shrink-0')} aria-label={label} data-testid={testId} />}
      >
        {children}
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Positioner sideOffset={6}>
          <Tooltip.Popup>
            <p className="m-0 max-w-56 text-[11px] leading-snug">{label}</p>
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

/** The green check beside a node the wallet covers right now. */
export function AffordableCheck({ label, testId }: { label: string; testId: string }) {
  return (
    <Mark label={label} testId={testId}>
      <span className="text-up">
        <Icon name="check" size="xs" />
      </span>
    </Mark>
  );
}

/** The coin crossed out beside a node that is open but costs more than the wallet holds. */
export function ShortOfGoldMark({ label, testId }: { label: string; testId: string }) {
  return (
    <Mark label={label} testId={testId}>
      <span className="relative inline-flex size-3.5">
        <img src={goldIconSrc()} alt="" aria-hidden className="size-3.5 object-contain opacity-70" draggable={false} />
        <span className="absolute -right-1 -bottom-1 rounded-full bg-surface text-down">
          <Icon name="x-mark" size="xs" />
        </span>
      </span>
    </Mark>
  );
}

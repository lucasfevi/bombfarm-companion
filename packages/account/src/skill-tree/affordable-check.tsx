import { Icon, Tooltip, cn } from '@bombfarm/ui';

/** The green check beside a node the wallet covers right now. */
export function AffordableCheck({ label, testId }: { label: string; testId: string }) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger
        delay={180}
        closeDelay={80}
        render={
          <span
            className={cn('inline-flex', 'shrink-0', 'text-up')}
            aria-label={label}
            data-testid={testId}
          />
        }
      >
        <Icon name="check" size="xs" />
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

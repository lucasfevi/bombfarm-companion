import { Popover } from '@base-ui/react/popover';
import { buttonRecipe } from './button.recipe';
import { cn } from './cn';
import { helpPopoverPopupClass, helpPopoverPositionerClass } from './help-tip.recipe';

export type HelpTipProps = {
  /** Accessible name for the ? trigger. */
  label: string;
  /** Body copy shown in the popover. */
  children: string;
  /**
   * When false, the trigger stays mounted but invisible so layout does not shift (CLS).
   * Prefer this over mount/unmount for status-linked help.
   */
  show?: boolean;
  /** Emphasize the trigger (e.g. active warn state). */
  active?: boolean;
  className?: string;
};

/**
 * Compact `?` help control (Button `help` / `help-on`) + Base UI Popover.
 * Always reserves the trigger slot; toggle with `show` + `invisible`.
 */
export function HelpTip({
  label,
  children,
  show = true,
  active = false,
  className,
}: HelpTipProps) {
  return (
    <Popover.Root>
      <Popover.Trigger
        type="button"
        className={cn(
          buttonRecipe({ variant: active ? 'help-on' : 'help' }),
          !show && 'invisible',
          className,
        )}
        aria-label={label}
        title={label}
        aria-hidden={!show}
        tabIndex={show ? undefined : -1}
        disabled={!show}
      >
        ?
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner className={helpPopoverPositionerClass} sideOffset={6}>
          <Popover.Popup className={helpPopoverPopupClass}>
            <Popover.Description className="m-0">{children}</Popover.Description>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

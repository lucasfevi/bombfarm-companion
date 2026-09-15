'use client';

import type { ReactNode, SyntheticEvent } from 'react';
import { cn, Tooltip } from '@bombfarm/ui';
import { peekPopupClass, peekTriggerClass } from './peek.recipe';

export type PeekKind = 'item' | 'hero' | 'ability';

export type PeekFrameProps = {
  kind: PeekKind;
  /** The card's body, rendered only while it is open. */
  card: ReactNode;
  /** What the reader hovers — the icon, drawn exactly as it would be without a card. */
  children: ReactNode;
  /**
   * Accessible name of the trigger, for an icon whose art is unnamed (an item, an ability). Leave
   * it off around an avatar: its `<img alt>` already names the hero, and a second name on the
   * wrapper reads as a second image.
   */
  label?: string | undefined;
  className?: string | undefined;
  /** A card that must not open — an icon drawn inside another card, say. Renders the bare children. */
  disabled?: boolean | undefined;
  /** Keep a click on the icon from activating the row it sits in. */
  stopRowActivation?: boolean | undefined;
};

/** The open delay the app's `Tooltip.Provider` sets, spelled here so a card needs no provider. */
const OPEN_DELAY_MS = 200;
const CLOSE_DELAY_MS = 80;

function stopPropagation(event: SyntheticEvent) {
  event.stopPropagation();
}

/**
 * The tooltip skeleton the three cards share. The trigger renders a `<span>`, not the primitive's
 * `<button>`: an avatar sits inside a clickable row or a switcher button on several screens, and
 * a button inside a button is not HTML. It is not in the tab order either, so a row with ten icons
 * keeps its one stop; the accessible name, when the art has none of its own, rides on it for a
 * reader that lands there.
 */
export function PeekFrame({
  kind,
  card,
  children,
  label,
  className,
  disabled,
  stopRowActivation,
}: PeekFrameProps) {
  if (disabled) return <>{children}</>;
  const stop = stopRowActivation ? stopPropagation : undefined;
  return (
    <Tooltip.Root>
      <Tooltip.Trigger
        render={<span role={label === undefined ? undefined : 'img'} />}
        tabIndex={-1}
        aria-label={label}
        delay={OPEN_DELAY_MS}
        closeDelay={CLOSE_DELAY_MS}
        data-peek={kind}
        className={cn(peekTriggerClass, className)}
        onClick={stop}
        onKeyDown={stop}
      >
        {children}
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Positioner sideOffset={6}>
          <Tooltip.Popup className={peekPopupClass} data-peek-card={kind}>
            {card}
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

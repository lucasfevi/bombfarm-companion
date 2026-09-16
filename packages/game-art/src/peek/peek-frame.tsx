'use client';

import { useState, type ReactNode, type SyntheticEvent } from 'react';
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
 * The tooltip skeleton the three cards share. Until a pointer first arrives the trigger is a bare
 * `<span>` around the art — an inventory draws five hundred icons, and a tooltip tree mounted
 * under each one at rest doubled that screen's render count for cards nobody had opened. The
 * first hover arms it: the tooltip tree mounts already open, since the pointer that opened it is
 * inside and will raise no second enter event — which is also why the frame owns the open state
 * and closes on the trigger's own pointer-leave: a tooltip opened by anything but its own hover
 * never learns the pointer has gone. From then on the icon behaves as any tooltip trigger does.
 *
 * The trigger renders a `<span>`, not the primitive's `<button>`: an avatar sits inside a
 * clickable row or a switcher button on several screens, and a button inside a button is not
 * HTML. It is not in the tab order either, so a row with ten icons keeps its one stop; the
 * accessible name, when the art has none of its own, rides on it for a reader that lands there.
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
  const [armed, setArmed] = useState(false);
  const [open, setOpen] = useState(false);
  if (disabled) return <>{children}</>;
  const stop = stopRowActivation ? stopPropagation : undefined;
  const role = label === undefined ? undefined : 'img';
  const triggerClass = cn(peekTriggerClass, className);

  if (!armed) {
    return (
      <span
        role={role}
        tabIndex={-1}
        aria-label={label}
        data-peek={kind}
        data-slot="peek-trigger"
        className={triggerClass}
        onPointerEnter={() => {
          setArmed(true);
          setOpen(true);
        }}
        onClick={stop}
        onKeyDown={stop}
      >
        {children}
      </span>
    );
  }

  return (
    <Tooltip.Root open={open} onOpenChange={(next) => setOpen(next)}>
      <Tooltip.Trigger
        render={<span role={role} />}
        tabIndex={-1}
        aria-label={label}
        delay={OPEN_DELAY_MS}
        closeDelay={CLOSE_DELAY_MS}
        data-peek={kind}
        className={triggerClass}
        onClick={stop}
        onKeyDown={stop}
        onPointerLeave={() => setOpen(false)}
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

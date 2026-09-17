'use client';

import { useEffect, useRef, useState, type ReactNode, type SyntheticEvent } from 'react';
import { cn, Tooltip } from '@bombfarm/ui';
import { peekPopupClass, peekTriggerClass } from './peek.recipe';

export type PeekKind = 'item' | 'hero' | 'ability';

export type PeekSpec = {
  kind: PeekKind;
  /** The card's body, rendered only while it is open. */
  card: ReactNode;
  /**
   * Accessible name of the trigger, for an icon whose art is unnamed (an item, an ability). Leave
   * it off around an avatar: its `<img alt>` already names the hero, and a second name on the
   * wrapper reads as a second image.
   */
  label?: string | undefined;
  className?: string | undefined;
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
 * Wraps `art` in the hover-card trigger the three cards share — as a hook, so the art primitive
 * itself is the trigger and an icon at rest costs no component it did not cost before the cards
 * existed: an inventory draws five hundred icons, and two wrapper components under each one
 * re-rendered on every commit of a screen where nobody had opened a card.
 *
 * Until a pointer first arrives the trigger is a bare `<span>` around the art. The first pointer
 * MOVE over it arms it — a move, not an enter, because the browser also raises an enter, and only
 * an enter, for an icon that a re-laid-out table or a closing menu slides under a pointer that
 * never moved, and a card that pops open unasked is worse than none. The tooltip tree then mounts
 * already open, since the pointer that opened it is inside and will raise no second enter —
 * which is also why the hook owns the open state and closes from a document-level pointer watch
 * rather than the trigger's own leave: a tooltip opened by anything but its own hover never
 * learns the pointer has gone. While a card is open, the first pointer move or press outside the
 * trigger and the card closes it.
 *
 * The trigger renders a `<span>`, not the primitive's `<button>`: an avatar sits inside a
 * clickable row or a switcher button on several screens, and a button inside a button is not
 * HTML. It is not in the tab order either, so a row with ten icons keeps its one stop; the
 * accessible name, when the art has none of its own, rides on it for a reader that lands there.
 * `undefined` for the spec renders the art bare — an icon drawn inside a card, say.
 */
export function usePeek(spec: PeekSpec | undefined, art: ReactNode): ReactNode {
  const [armed, setArmed] = useState(false);
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const closeIfOutside = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (triggerRef.current?.contains(target) || (target instanceof Element && target.closest('[data-peek-card]'))) return;
      setOpen(false);
    };
    document.addEventListener('pointermove', closeIfOutside, true);
    document.addEventListener('pointerdown', closeIfOutside, true);
    return () => {
      document.removeEventListener('pointermove', closeIfOutside, true);
      document.removeEventListener('pointerdown', closeIfOutside, true);
    };
  }, [open]);

  if (spec === undefined) return art;
  const { kind, card, label, className, stopRowActivation } = spec;
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
        onPointerMove={() => {
          setArmed(true);
          setOpen(true);
        }}
        onClick={stop}
        onKeyDown={stop}
      >
        {art}
      </span>
    );
  }

  return (
    <Tooltip.Root open={open} onOpenChange={(next) => setOpen(next)}>
      <Tooltip.Trigger
        ref={triggerRef}
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
        {art}
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

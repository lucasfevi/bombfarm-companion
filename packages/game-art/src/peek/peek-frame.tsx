'use client';

import type { ReactNode } from 'react';
import { usePeek, type PeekKind } from './use-peek';

export type { PeekKind };

export type PeekFrameProps = {
  kind: PeekKind;
  /** The card's body, rendered only while it is open. */
  card: ReactNode;
  /** What the reader hovers — the icon, drawn exactly as it would be without a card. */
  children: ReactNode;
  /** Accessible name of the trigger, for art that has none of its own. */
  label?: string | undefined;
  className?: string | undefined;
  /** A card that must not open — an icon drawn inside another card, say. Renders the bare children. */
  disabled?: boolean | undefined;
  /** Keep a click on the icon from activating the row it sits in. */
  stopRowActivation?: boolean | undefined;
};

/** The hover-card trigger as a component, for a caller that wraps something other than one of
 *  the art primitives — those take a `peek` prop and pay no wrapper at rest. */
export function PeekFrame({ kind, card, children, label, className, disabled, stopRowActivation }: PeekFrameProps) {
  return usePeek(disabled ? undefined : { kind, card, label, className, stopRowActivation }, children);
}

import { createContext, useContext } from 'react';

/**
 * Tracks `open` as a plain reactive value (mirrors the controlled `open` prop, or Base UI's
 * own uncontrolled state via `onOpenChange`) so `Panel` can read it with `useContext` — a real
 * hook subscription Motion's `animate` prop reacts to correctly.
 */
export const CollapsibleOpenContext = createContext(false);

export function useCollapsibleOpen(): boolean {
  return useContext(CollapsibleOpenContext);
}

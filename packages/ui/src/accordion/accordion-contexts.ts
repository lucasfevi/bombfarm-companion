import { createContext } from 'react';

/**
 * Tracks the open item values as a plain reactive value (see `Collapsible.tsx`'s
 * `OpenContext` for why: `Panel`'s Motion `animate` prop needs a real hook subscription).
 */
export const AccordionOpenContext = createContext<string[]>([]);
/** Set by `Item` so its own `Panel` can look itself up in `AccordionOpenContext`. */
export const AccordionItemValueContext = createContext<string | undefined>(undefined);

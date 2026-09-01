'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { FarmScreenCopy, Lang } from '../copy';

export type FarmCopyValue = { t: FarmScreenCopy; lang: Lang };

const FarmCopyContext = createContext<FarmCopyValue | null>(null);

/**
 * The explorer's nine leaf panels read their strings and their language from here rather than
 * taking two more props each. Threading `t`/`lang` through the panel tree would push several of
 * them over the eight-prop budget for values that are the same on every one of them.
 *
 * `PhasesExplorerView` mounts this itself from its own `t`/`lang` props, so a host renders the
 * screen without a second, separately-supplied copy of the same two values. It is exported for the
 * host that renders one of those panels on its own, outside the explorer.
 */
export function FarmCopyProvider({
  t,
  lang,
  children,
}: {
  t: FarmScreenCopy;
  lang: Lang;
  children: ReactNode;
}) {
  const value = useMemo(() => ({ t, lang }), [t, lang]);
  return <FarmCopyContext.Provider value={value}>{children}</FarmCopyContext.Provider>;
}

/**
 * Throws rather than returning `undefined`: a missing provider would otherwise render every label
 * on the screen blank, which reads as a copy bug in a dictionary that is in fact complete.
 */
export function useFarmCopy(): FarmCopyValue {
  const value = useContext(FarmCopyContext);
  if (value == null) {
    throw new Error(
      'useFarmCopy() was called outside <FarmCopyProvider>. Render the farm screen through ' +
        'PhasesExplorerView, or wrap the panel in FarmCopyProvider with the host dictionary.',
    );
  }
  return value;
}

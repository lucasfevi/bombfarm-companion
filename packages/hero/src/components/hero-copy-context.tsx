'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { HeroPanelCopy, Lang } from '../copy';

export type HeroCopyValue = { t: HeroPanelCopy; lang: Lang };

const HeroCopyContext = createContext<HeroCopyValue | null>(null);

/**
 * The hero leaf panels read their strings and their language from here rather than taking two more
 * props each. Threading `t`/`lang` through the panel tree would push several of them over the
 * eight-prop budget for values that are the same on every one of them.
 *
 * The screen that renders those panels mounts this itself from its own `t`/`lang` props, so a host
 * renders the screen without a second, separately-supplied copy of the same two values. It is
 * exported for the host that renders one of those panels on its own, outside that screen.
 */
export function HeroCopyProvider({
  t,
  lang,
  children,
}: {
  t: HeroPanelCopy;
  lang: Lang;
  children: ReactNode;
}) {
  const value = useMemo(() => ({ t, lang }), [t, lang]);
  return <HeroCopyContext.Provider value={value}>{children}</HeroCopyContext.Provider>;
}

/**
 * Throws rather than returning `undefined`: a missing provider would otherwise render every label
 * on the screen blank, which reads as a copy bug in a dictionary that is in fact complete.
 */
export function useHeroCopy(): HeroCopyValue {
  const value = useContext(HeroCopyContext);
  if (value == null) {
    throw new Error(
      'useHeroCopy() was called outside <HeroCopyProvider>. Render the panel through the screen ' +
        'that mounts the provider, or wrap it in HeroCopyProvider with the host dictionary.',
    );
  }
  return value;
}

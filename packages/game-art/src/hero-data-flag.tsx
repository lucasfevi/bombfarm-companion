'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { Tooltip, cn } from '@bombfarm/ui';

/** Why a hero is left out of calculations, already in the player's language. */
export type HeroDataFlag = { readonly label: string; readonly tip: string };

export type HeroDataFlagResolver = (heroId: string) => HeroDataFlag | undefined;

const noHeroDataFlag: HeroDataFlagResolver = () => undefined;

const HeroDataFlagContext = createContext<HeroDataFlagResolver>(noHeroDataFlag);

/** Hands every avatar below it the host's answer to "is this hero held back, and why?". Without
 *  one no avatar wears a flag. */
export function HeroDataFlagProvider({ resolve, children }: { resolve: HeroDataFlagResolver; children: ReactNode }) {
  return <HeroDataFlagContext.Provider value={resolve}>{children}</HeroDataFlagContext.Provider>;
}

export function useHeroDataFlag(heroId: string | undefined): HeroDataFlag | undefined {
  const resolve = useContext(HeroDataFlagContext);
  return heroId === undefined ? undefined : resolve(heroId);
}

const dotClass =
  'absolute -top-1 -right-1 z-10 size-2.5 cursor-help rounded-full bg-warn ring-2 ring-surface after:absolute after:-inset-1.5 after:content-[""] focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent';

export function HeroDataFlagDot({ flag, className }: { flag: HeroDataFlag; className?: string | undefined }) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger
        render={<span role="img" />}
        tabIndex={0}
        aria-label={`${flag.label}: ${flag.tip}`}
        delay={180}
        closeDelay={80}
        data-testid="hero-data-flag"
        className={cn(dotClass, className)}
      />
      <Tooltip.Portal>
        <Tooltip.Positioner sideOffset={6}>
          <Tooltip.Popup>
            <p className="m-0 max-w-72 text-[11px] leading-snug">{flag.tip}</p>
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { SheetStats } from '@bombfarm/domain/gear';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';

/** A hero as a hover card's sheet is composed from — a stored record, or an import candidate. */
export type HeroPeekStatsSubject = Omit<HeroRecord, 'id' | 'updatedAt'> & { readonly id?: string | undefined };

/** The host's answer to "what does this hero's detail panel total?" — `undefined` where it prints nothing. */
export type HeroPeekStatsResolver = (hero: HeroPeekStatsSubject) => SheetStats | undefined;

const noHeroPeekStats: HeroPeekStatsResolver = () => undefined;

const HeroPeekStatsContext = createContext<HeroPeekStatsResolver>(noHeroPeekStats);

/**
 * Hands every hover card below it its host's sheet. Without one a card prints no statistics
 * rather than a sheet composed against nothing.
 */
export function HeroPeekStatsProvider({ resolve, children }: { resolve: HeroPeekStatsResolver; children: ReactNode }) {
  return <HeroPeekStatsContext.Provider value={resolve}>{children}</HeroPeekStatsContext.Provider>;
}

export function useHeroPeekStats(): HeroPeekStatsResolver {
  return useContext(HeroPeekStatsContext);
}

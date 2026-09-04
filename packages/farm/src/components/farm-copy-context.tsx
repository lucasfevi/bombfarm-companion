'use client';

import { useHeroCopy } from '@bombfarm/hero/components';
import type { FarmScreenCopy, Lang } from '../copy';

export { HeroCopyProvider as FarmCopyProvider } from '@bombfarm/hero/components';

export type FarmCopyValue = { t: FarmScreenCopy; lang: Lang };

/**
 * The assertion is sound because this screen is the only thing that mounts the provider, and it
 * mounts it from its own `FarmScreenCopy` prop — the hero contract the lookup is declared against
 * is a subset of that type, so the object in the context really is the wider dictionary at runtime.
 */
export function useFarmCopy(): FarmCopyValue {
  return useHeroCopy() as FarmCopyValue;
}

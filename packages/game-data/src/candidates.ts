export interface MemoryCandidate {
  addr: bigint;
  size: number;
  gold: number | null;
  json: string;
}

export const MAX_CANDIDATES = 25;

export function pickHighestGoldCandidate<T extends { gold: number | null }>(
  candidates: readonly T[],
): T | null {
  if (candidates.length === 0) return null;
  const capped = candidates.slice(0, MAX_CANDIDATES);
  return [...capped].sort((a, b) => (b.gold ?? -1) - (a.gold ?? -1))[0] ?? null;
}

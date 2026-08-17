import type { HeroEnergy, HeroSummary, RawHeroEnergy, RawHeroRecord } from '@bombfarm/contracts';
import { isPlausibleId, isRecord } from '../validation.js';

export function classifyHeroRecord(value: unknown): value is RawHeroRecord {
  if (!isRecord(value)) return false;
  if (!isPlausibleId(value.id)) return false;
  return typeof value.name === 'string' || isRecord(value.stats);
}

export function classifyHeroEnergy(value: unknown): value is RawHeroEnergy {
  if (!isRecord(value)) return false;
  if (!isPlausibleId(value.id)) return false;
  return typeof value.energia_atual === 'number' && typeof value.energia_max === 'number';
}

export function mapHeroRecord(raw: RawHeroRecord): HeroSummary {
  const summary: HeroSummary = {
    id: raw.id,
    name: raw.name ?? raw.id,
  };
  if (typeof raw.level === 'number') summary.level = raw.level;
  if (raw.in_field === true) summary.inField = true;
  else if (raw.in_field === false) summary.inField = false;
  return summary;
}

export function mapHeroEnergy(raw: RawHeroEnergy): HeroEnergy {
  return {
    current: raw.energia_atual ?? 0,
    max: raw.energia_max ?? 0,
    percent: raw.energia_pct ?? 0,
    state: raw.state ?? 'UNKNOWN',
    inField: raw.in_field === true,
    inCasa: raw.in_casa === true,
    recovering: raw.recovering === true,
  };
}

export function mergeHeroSummaries(
  records: HeroSummary[],
  energies: Map<string, HeroEnergy>,
): HeroSummary[] {
  return records.map((hero) => {
    const energy = energies.get(hero.id);
    return energy ? { ...hero, energy } : hero;
  });
}

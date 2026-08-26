/** Shortened hero record id for compact identity chrome (roster/plan rows, cards). */
export function shortHeroRecordId(hero: { id: string; sourceId?: string }): string {
  const raw = hero.sourceId ?? hero.id;
  return raw.length > 5 ? raw.slice(-5) : raw;
}

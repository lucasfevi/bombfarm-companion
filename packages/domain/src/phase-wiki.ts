import wiki from './data/phase-wiki.json';
import phaseMapNamesEn from './data/phase-map-names-en.json';

export type WikiPhaseLine = (typeof wiki.lines)[number];
export type WikiProp = (typeof wiki.props)[number];
export type ItemLevelBand = (typeof wiki.itemPorFase)[number];

export const WIKI_PHASE_LINES: WikiPhaseLine[] = wiki.lines;
export const WIKI_PROPS: WikiProp[] = wiki.props;
export const PROPS_POR_ATO: number[] = wiki.propsPorAto;
export const BOSS_HP_MULT_WIKI = wiki.bossHpMult;
export const REP_HP_MULT = wiki.repHpMult;
export const JAULA = wiki.jaula;
export const HERO_CHEST_RARITY_BY_ATO = wiki.heroChestRarityByAto;
export const CHEST_RARITY_DIST = wiki.chestRarityDist;
export const ITEM_POR_FASE: ItemLevelBand[] = wiki.itemPorFase;
export const XP_FASE_INI = wiki.xpFaseIni;
export const XP_FASE_FIM = wiki.xpFaseFim;
export const GATE_SECS_POR_ATO = wiki.gateSecsPorAto;
export const ATO_LABELS: string[] = wiki.atoLabels;
export const PHASE_NAMES: string[] = wiki.phaseNames;
export const PHASE_MAP_NAMES_EN: string[] = phaseMapNamesEn;
/** fases-nomes suffix per ato (ato 1 has none). Full in-game names append these in PT. */
export const PHASE_NAME_SUFFIXES = ['', ' (Nightmare)', ' (Hell)', ' (Torment)', ' (Inferno)'] as const;
export const WIKI_SYNCED_AT = wiki.syncedAt;

const MAX_PHASE = 600;

export function wikiPhaseLine(phase: number): WikiPhaseLine | undefined {
  const clampedPhase = Math.max(1, Math.min(MAX_PHASE, Math.round(phase)));
  return WIKI_PHASE_LINES[clampedPhase - 1];
}

/** Game UI difficulty labels (ato 1–5) — not fases-nomes suffix names. */
export const GAME_DIFFICULTY_EN = ['Easy', 'Normal', 'Hard', 'Very Hard', 'Inferno'] as const;
export const GAME_DIFFICULTY_PT = ['Fácil', 'Normal', 'Difícil', 'Muito Difícil', 'Inferno'] as const;

export type PhaseMapOption = {
  phase: number;
  mundo: number;
  subIndex: number;
  /** In-game map coordinate within the difficulty, e.g. `2-1`. */
  coord: string;
  /** Flavor name — base name only (difficulty is a separate picker). */
  name: string;
};

const PHASE_NAME_COUNT = PHASE_NAMES.length;

/** Base map flavor name for UI (no difficulty suffix). EN names are provisional. */
export function phaseMapDisplayName(phase: number, lang: 'en' | 'pt'): string {
  const baseIdx = (Math.max(1, Math.min(MAX_PHASE, Math.round(phase))) - 1) % PHASE_NAME_COUNT;
  if (lang === 'pt') return PHASE_NAMES[baseIdx] ?? `Fase ${phase}`;
  return PHASE_MAP_NAMES_EN[baseIdx] ?? PHASE_NAMES[baseIdx] ?? `Phase ${phase}`;
}

/** Full in-game flavor name including fases-nomes difficulty suffix. */
export function phaseMapFullName(phase: number, lang: 'en' | 'pt'): string {
  const line = wikiPhaseLine(phase);
  const base = phaseMapDisplayName(phase, lang);
  if (!line || line.ato <= 1) return base;
  const suffix = PHASE_NAME_SUFFIXES[line.ato - 1] ?? '';
  return `${base}${suffix}`;
}

export function formatMapOptionLabel(row: PhaseMapOption): string {
  return `${row.coord} · ${row.name}`;
}

export function gameDifficultyLabel(ato: number, lang: 'en' | 'pt'): string {
  const labels = lang === 'pt' ? GAME_DIFFICULTY_PT : GAME_DIFFICULTY_EN;
  return labels[Math.max(0, Math.min(4, Math.round(ato) - 1))] ?? String(ato);
}

/** All wiki phases for one difficulty band (ato 1–5), in phase order. */
export function listMapsForAto(ato: number, lang: 'en' | 'pt' = 'en'): PhaseMapOption[] {
  const band = Math.max(1, Math.min(5, Math.round(ato)));
  const options: PhaseMapOption[] = [];
  // MOD-36: loop counter — scans every wiki phase line to collect this ato's maps.
  for (let phaseCursor = 1; phaseCursor <= MAX_PHASE; phaseCursor++) {
    const line = wikiPhaseLine(phaseCursor);
    if (!line || line.ato !== band) continue;
    const subIndex = phaseSubIndex(phaseCursor);
    options.push({
      phase: line.phase,
      mundo: line.mundo,
      subIndex,
      coord: `${line.mundo}-${subIndex}`,
      name: phaseMapDisplayName(line.phase, lang),
    });
  }
  return options;
}

export function firstPhaseForAto(ato: number): number {
  return listMapsForAto(ato)[0]?.phase ?? 1;
}

/** Resolve wiki phase from difficulty + in-game map coordinate. */
export function phaseForMapCoord(ato: number, mundo: number, subIndex: number): number | null {
  const match = listMapsForAto(ato).find(
    (row) => row.mundo === mundo && row.subIndex === subIndex,
  );
  return match?.phase ?? null;
}

export function phaseMapCoord(phase: number): { ato: number; mundo: number; subIndex: number } | null {
  const line = wikiPhaseLine(phase);
  if (!line) return null;
  return { ato: line.ato, mundo: line.mundo, subIndex: phaseSubIndex(phase) };
}

/** 1-based index of this phase within its (ato, mundo) band — e.g. 65 → 15, 151 → 1. */
export function phaseSubIndex(phase: number): number {
  const line = wikiPhaseLine(phase);
  if (!line) return phase;
  // MOD-36: genuine accumulator — counts prior phases sharing this (ato, mundo) band.
  let index = 0;
  for (let phaseCursor = 1; phaseCursor <= phase; phaseCursor++) {
    const row = wikiPhaseLine(phaseCursor);
    if (row && row.ato === line.ato && row.mundo === line.mundo) index++;
  }
  return index;
}

/** Coordinate only, e.g. `Hard 1-1`. */
export function formatPhaseCoord(phase: number, lang: 'en' | 'pt'): string {
  const line = wikiPhaseLine(phase);
  if (!line) return String(phase);
  const labels = lang === 'pt' ? GAME_DIFFICULTY_PT : GAME_DIFFICULTY_EN;
  const diff = labels[line.ato - 1] ?? String(line.ato);
  return `${diff} ${line.mundo}-${phaseSubIndex(phase)}`;
}

/** Display label aligned with in-game coordinates, e.g. `Hard 1-1 (151)`. */
export function formatPhaseLabel(phase: number, lang: 'en' | 'pt'): string {
  return `${formatPhaseCoord(phase, lang)} (${phase})`;
}

/** @deprecated Wiki flavor name — prefer {@link phaseMapDisplayName} for UI. */
export function phaseName(phase: number): string {
  return phaseMapFullName(phase, 'pt');
}

export function propCountForAto(ato: number): number {
  const index = Math.max(1, Math.min(5, Math.round(ato))) - 1;
  return PROPS_POR_ATO[index] ?? PROPS_POR_ATO[0];
}

/** Linear XP per prop kill (phase 1 → 3, phase 600 → 300). */
export function xpPerProp(phase: number): number {
  const clampedPhase = Math.max(1, Math.min(MAX_PHASE, Math.round(phase)));
  const progress = (clampedPhase - 1) / (MAX_PHASE - 1);
  return XP_FASE_INI + progress * (XP_FASE_FIM - XP_FASE_INI);
}

/** Item level tiers that can roll on this phase (overlapping bands). */
export function itemLevelsForPhase(phase: number): number[] {
  const clampedPhase = Math.max(1, Math.min(MAX_PHASE, Math.round(phase)));
  const levels = ITEM_POR_FASE.filter((band) => clampedPhase >= band.min && clampedPhase <= band.max).map((band) => band.itemLevel);
  return [...new Set(levels)].sort((left, right) => left - right);
}

/** Human label e.g. "level 40–60" or "level 60" when single tier. */
export function itemLevelDropLabel(levels: number[]): string {
  if (levels.length === 0) return '';
  if (levels.length === 1) return String(levels[0]);
  return `${levels[0]}–${levels[levels.length - 1]}`;
}

/** Jaula early-arrival cap at this phase (0..1). */
export function jaulaEarlyCap(phase: number): number {
  const clampedPhase = Math.max(1, Math.min(MAX_PHASE, Math.round(phase)));
  const { adiantaProbIni, adiantaProbMax } = JAULA;
  return adiantaProbIni + (adiantaProbMax - adiantaProbIni) * ((clampedPhase - 1) / (MAX_PHASE - 1));
}

/** Gold multiplier vs Comum for prop rarity index (live-validated formula). */
export function goldRarityMult(rarityIndex: number): number {
  return 1 + 0.4 * rarityIndex;
}

const RARITY_LABELS_EN = ['Comum', 'Incomum', 'Raro', 'Épico', 'Lendária', 'Mítico'] as const;
const RARITY_LABELS_PT = ['Comum', 'Incomum', 'Raro', 'Épico', 'Lendária', 'Mítico'] as const;

export function rarityLabel(index: number, lang: 'en' | 'pt'): string {
  const labels = lang === 'pt' ? RARITY_LABELS_PT : RARITY_LABELS_EN;
  return labels[Math.max(0, Math.min(5, index))] ?? labels[0];
}

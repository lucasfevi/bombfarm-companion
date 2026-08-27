// MP5 F5 — rendering. Every function here is pure text assembly: it names WHICH sections
// differ, with WHICH hashes, and reports the ONE outcome the run reached. It never says what a
// difference means or what to do about it — that is F6's job (triage), not this feature's.

import { DATA_URL, FASES_NOMES_URL } from './fetch-endpoints.mjs';

export const TRACKER_MARKER = '<!-- bfc-wiki-drift-tracker -->';

/**
 * Which committed files carry values from each wiki section (design §2.6). Keyed by
 * `${endpoint}.${section}`; values are repo-relative paths, and `renderIssueBody` prints them, so
 * a drift issue names where to look without anyone opening this file.
 *
 * NOT only the generated JSON artifacts. A wiki value that lives as a hand-maintained constant in
 * source belongs here too — `data.rotacao`'s field and House ceilings are exactly that, and
 * listing only `phase-wiki.json` for it sent a reader to a file that does not hold them.
 *
 * `data.bolsa`/`combate`/`ritual`/`skill_tree`/`stat_kinds` and `fasesNomes.disponivel`/`mundos`/
 * `sufixos`/`zonas` back nothing today and are deliberately absent — `skill_tree` in particular
 * backs no committed file but is the section the wiki drift check reasoned from, so it still sits
 * inside the baseline; its absence here only affects how the "backs nothing" note reads.
 */
export const ARTIFACT_BACKED_SECTIONS = {
  // lines, gateSecsPorAto (phase-wiki.json); lines (phases.json)
  'data.fases': ['packages/domain/src/data/phase-wiki.json', 'packages/domain/src/data/phases.json'],
  // props, propsPorAto, bossHpMult, repHpMult, jaula
  'data.entidades': ['packages/domain/src/data/phase-wiki.json'],
  // heroChestRarityByAto, chestRarityDist, DROP_RATES, KEY_GATE_COST, RETURN_BONUS_ADD,
  // RETURN_BONUS_ADD_VIP
  'data.drops': ['packages/domain/src/data/phase-wiki.json'],
  // itemPorFase, xpFaseIni, xpFaseFim
  'data.herois': ['packages/domain/src/data/phase-wiki.json'],
  // WIKI_GEMS: chestDropRate, rankDistByAto, list — also aliased as GEM_RANK_DIST_BY_ATO / GEM_LIST
  'data.gemas': ['packages/domain/src/data/phase-wiki.json'],
  // LOOT_ABILITY_VALUES / lootAbilities
  'data.habilidades': ['packages/domain/src/data/phase-wiki.json'],
  // DROP_RATES.time / drops.timechestDropRate, TIMECHEST_RARITY_BY_ATO / timechestRarityByAto
  // (phase-wiki.json); FIELD_SLOTS_MAX from `campo`, CASA_SLOTS_PER_HOUSE / CASA_SLOTS_MAX from
  // `casas[].slots` (casa-slots.ts); HOUSES cycle endpoints from `casas[].cycle_secs_base` /
  // `cycle_secs_max`, HOUSE_MAX_LEVEL from `casa_max_level` (model/house.ts)
  'data.rotacao': [
    'packages/domain/src/data/phase-wiki.json',
    'packages/domain/src/casa-slots.ts',
    'packages/domain/src/model/house.ts',
  ],
  // defs, sets, levels, version — version === itens.versao_catalogo
  'data.itens': ['packages/domain/src/data/catalog.json'],
  // slots
  'data.slots': ['packages/domain/src/data/catalog.json'],
  // itemStats
  'data.item_stats': ['packages/domain/src/data/catalog.json'],
  // rarities
  'data.raridades': ['packages/domain/src/data/catalog.json'],
  // atoLabels
  'fasesNomes.atos': ['packages/domain/src/data/phase-wiki.json'],
  // phaseNames
  'fasesNomes.fases': ['packages/domain/src/data/phase-wiki.json'],
};

const FORBIDDEN_INTERPRETATION_PHRASES = ['means', 'because', 'probably', 'likely', 'you should'];

/** Qualifies a diff's section with its endpoint, e.g. "data.fases" — disambiguates the fact that
 * both endpoints happen to carry a section literally named "fases". Falls back to the endpoint
 * alone for whole-payload diffs, which carry no section name. */
function sectionLabel(diff) {
  if (diff.section == null) return diff.endpoint ?? 'payload';
  return diff.endpoint ? `${diff.endpoint}.${diff.section}` : diff.section;
}

/**
 * One outcome line, plus (for `drift`) every differing section named with both hashes, and (for
 * `unreachable`/`baseline-missing`) the reason — attributable from this text alone (MWD-06,
 * MWD-27, MWD-29).
 *
 * @param {{ outcome: 'ok'|'drift'|'unreachable'|'baseline-missing', diffs?: Array<object>, reason?: string, url?: string, observedAt?: string, runUrl?: string }} args
 */
export function renderSummary({ outcome, diffs = [], reason, url, observedAt, runUrl }) {
  const lines = [`outcome: ${outcome}`];

  if (outcome === 'unreachable') {
    lines.push(`reason: ${reason}`);
    if (url) lines.push(`url: ${url}`);
  } else if (outcome === 'baseline-missing') {
    lines.push(`reason: ${reason}`);
  } else if (outcome === 'drift') {
    const added = diffs.filter((d) => d.kind === 'section-added');
    const removed = diffs.filter((d) => d.kind === 'section-removed');
    const changed = diffs.filter((d) => d.kind === 'section-changed');
    const payloadChanged = diffs.filter((d) => d.kind === 'payload-changed');
    const versaoChanged = diffs.filter((d) => d.kind === 'versao-catalogo-changed');

    if (changed.length > 0) {
      lines.push('changed sections:');
      for (const d of changed) {
        lines.push(`  - ${sectionLabel(d)}: baseline ${d.baselineSha256} -> observed ${d.observedSha256}`);
      }
    }
    if (added.length > 0) {
      lines.push('added sections:');
      for (const d of added) lines.push(`  - ${sectionLabel(d)} (observed ${d.observedSha256})`);
    }
    if (removed.length > 0) {
      lines.push('removed sections:');
      for (const d of removed) lines.push(`  - ${sectionLabel(d)} (baseline ${d.baselineSha256})`);
    }
    if (versaoChanged.length > 0) {
      for (const d of versaoChanged) lines.push(`versao_catalogo: ${d.from} -> ${d.to}`);
    }
    if (payloadChanged.length > 0 && added.length === 0 && removed.length === 0 && changed.length === 0) {
      lines.push(
        'reorder-only signature: the whole-payload hash changed with zero section hashes differing',
      );
    }
  }

  if (observedAt) lines.push(`observed at: ${observedAt}`);
  if (runUrl) lines.push(`run: ${runUrl}`);

  return lines.join('\n');
}

/** `Wiki data drift — N section(s) differ` — stable prefix, count of sections that actually
 * differ by name (added + removed + changed; a whole-payload-only reorder counts zero). */
export function renderIssueTitle(diffs) {
  const differingSections = diffs.filter((d) => d.section != null).length;
  return `Wiki data drift — ${differingSections} section(s) differ`;
}

/**
 * @param {{ diffs: Array<object>, observedAt: string, runUrl: string }} args
 */
export function renderIssueBody({ diffs, observedAt, runUrl }) {
  const added = diffs.filter((d) => d.kind === 'section-added');
  const removed = diffs.filter((d) => d.kind === 'section-removed');
  const changed = diffs.filter((d) => d.kind === 'section-changed');
  const versaoDiff = diffs.find((d) => d.kind === 'versao-catalogo-changed');

  const lines = [TRACKER_MARKER, ''];
  lines.push(`Endpoints checked: ${DATA_URL} , ${FASES_NOMES_URL}`);
  lines.push(`Observed at: ${observedAt}`);
  lines.push(`Run: ${runUrl}`);
  lines.push('');

  if (changed.length > 0) {
    lines.push('| Section | Baseline sha256 | Observed sha256 |');
    lines.push('| --- | --- | --- |');
    for (const d of changed) lines.push(`| ${sectionLabel(d)} | ${d.baselineSha256} | ${d.observedSha256} |`);
    lines.push('');
  }

  if (added.length > 0) {
    lines.push('Added sections:');
    for (const d of added) lines.push(`- ${sectionLabel(d)}`);
    lines.push('');
  }

  if (removed.length > 0) {
    lines.push('Removed sections:');
    for (const d of removed) lines.push(`- ${sectionLabel(d)}`);
    lines.push('');
  }

  if (versaoDiff) {
    lines.push(`versao_catalogo: ${versaoDiff.from} -> ${versaoDiff.to}`);
    lines.push('');
  }

  const differingLabels = [...new Set([...changed, ...added, ...removed].map(sectionLabel))];
  const backedLabels = differingLabels.filter((label) => ARTIFACT_BACKED_SECTIONS[label]);
  // Naming the files is still reporting, not triage: this is the map's own content, printed. It
  // says where the differing section's values are committed, never what to change or whether to.
  if (backedLabels.length > 0) {
    lines.push('Committed files carrying values from the differing sections:');
    for (const label of backedLabels) {
      lines.push(`- ${label}: ${ARTIFACT_BACKED_SECTIONS[label].join(', ')}`);
    }
    lines.push('');
  }
  if (differingLabels.length > 0 && backedLabels.length === 0) {
    lines.push('None of the differing sections back a committed companion artifact today.');
    lines.push('');
  }

  return lines.join('\n').trimEnd();
}

/** Exposed for the report's own adequacy test — never used by the rendered output itself. */
export const FORBIDDEN_INTERPRETATION_PHRASES_FOR_TEST = FORBIDDEN_INTERPRETATION_PHRASES;

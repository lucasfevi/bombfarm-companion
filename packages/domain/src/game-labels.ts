/**
 * Bilingual display maps for game terms. Internal ids/keys stay PT-key stable;
 * only labels follow `Lang`.
 */
import type { Lang } from './shims/i18n';
import type { RarityKey, StatKey } from './model';
import { type Slot } from './gear';
import type { TeamBuffId } from './team-buffs';
import catalog from './data/catalog.json';

type Bilingual = { pt: string; en: string };

function pick(entry: Bilingual | undefined, lang: Lang, fallback: string): string {
  if (!entry) return fallback;
  return entry[lang];
}

/** Ability display name. id e.g. 'ponta_diamante'. */
export function abilityName(abilityId: string, lang: Lang): string {
  return pick(ABILITY_NAMES[abilityId], lang, abilityId);
}

/** Ability effect blurb. Numbers must stay aligned with AbilityEffect math. */
export function abilityEffectText(abilityId: string, lang: Lang): string {
  return pick(ABILITY_EFFECTS[abilityId], lang, abilityId);
}

/** Hero rarity label. key stays 'Comum' | … */
export function rarityLabel(key: RarityKey, lang: Lang): string {
  return pick(RARITY_LABELS[key], lang, key);
}

/** Item rarity label by catalog rarity index 0..5. */
export function itemRarityLabel(rarityIdx: number, lang: Lang): string {
  return pick(ITEM_RARITY_LABELS[rarityIdx], lang, String(rarityIdx));
}

/** House display name by index 0..4. */
export function houseLabel(houseIndex: number, lang: Lang): string {
  return pick(HOUSE_LABELS[houseIndex], lang, String(houseIndex));
}

/** Equipment slot label. key stays 'arma' | 'elmo' | … */
export function slotLabel(slot: Slot, lang: Lang): string {
  return pick(SLOT_LABELS[slot], lang, slot);
}

/** Sheet / advisor stat label. */
export function statLabel(stat: StatKey, lang: Lang): string {
  return pick(STAT_LABEL_MAP[stat], lang, stat);
}

/** Team-buff field label (ability id). */
export function teamBuffLabel(buffId: TeamBuffId, lang: Lang): string {
  return abilityName(buffId, lang);
}

/**
 * Catalog item-stat key label when shown in UI
 * (e.g. 'energia' | 'penetracao' | 'velocidade' | 'dmg' | …).
 */
export function itemStatLabel(stat: string, lang: Lang): string {
  return pick(ITEM_STAT_LABELS[stat], lang, stat);
}

/** Prop target label. id stays phases.json `name` (e.g. 'minerio_mithril'). */
export function propLabel(propId: string, lang: Lang): string {
  return pick(PROP_LABELS[propId], lang, propId);
}

/** Equipment set display name. id stays catalog slug (e.g. 'clay'). */
export function setName(setId: string, lang: Lang): string {
  return pick(SET_LABELS[setId], lang, setId);
}

/**
 * Composed user-visible item line (set + slot + rarity + level/forge).
 * Set, slot, and rarity follow `Lang`.
 */
export function formatItemDisplay(
  item: { defId: string; rarityIdx: number; level: number; upgrade: number },
  lang: Lang,
): string {
  const definition = catalog.defs.find((entry) => entry.id === item.defId);
  const rar = itemRarityLabel(item.rarityIdx, lang);
  const plus = item.upgrade > 0 ? ` +${item.upgrade}` : '';
  if (!definition) return item.defId;
  const set = setName(definition.set, lang);
  const slot = slotLabel(definition.slot, lang);
  return `${set} ${slot} · ${rar} nv${item.level}${plus}`;
}

/** Roster gear tooltip — title: item + forge; subtitle: level + rarity (no slot header). */
export function formatItemRosterTooltip(
  item: { defId: string; rarityIdx: number; level: number; upgrade: number },
  lang: Lang,
  lvLabel: string,
): { title: string; subtitle: string } {
  const definition = catalog.defs.find((entry) => entry.id === item.defId);
  const rar = itemRarityLabel(item.rarityIdx, lang);
  const plus = item.upgrade > 0 ? ` +${item.upgrade}` : '';
  if (!definition) {
    return { title: `${item.defId}${plus}`, subtitle: `${lvLabel} ${item.level} ${rar}` };
  }
  const name = `${setName(definition.set, lang)} ${slotLabel(definition.slot, lang)}`;
  return { title: `${name}${plus}`, subtitle: `${lvLabel} ${item.level} ${rar}` };
}

// --- Maps ---

const ABILITY_NAMES: Record<string, Bilingual> = {
  bateria_extra: { pt: 'Bateria Extra', en: 'Extra Battery' },
  caca_hero: { pt: 'Caça-Hero', en: 'Hero Hunter' },
  marcha_acelerada: { pt: 'Marcha Acelerada', en: 'Forced March' },
  pressagio_mortal: { pt: 'Presságio Mortal', en: 'Deadly Omen' },
  fantasma: { pt: 'Fantasma', en: 'Ghost' },
  ponta_diamante: { pt: 'Ponta de Diamante', en: 'Diamond Tip' },
  misericordia: { pt: 'Misericórdia', en: 'Mercy' },
  explosao_ampla: { pt: 'Explosão Ampla', en: 'Wide Blast' },
  contra_relogio: { pt: 'Contra o Relógio', en: 'Against the Clock' },
  olho_clinico: { pt: 'Olho Clínico', en: 'Keen Eye' },
  detonacao_dupla: { pt: 'Detonação Dupla', en: 'Double Detonation' },
  folego_mineiro: { pt: 'Fôlego de Mineiro', en: "Miner's Breath" },
  passagem_bastao: { pt: 'Passagem de Bastão', en: 'Baton Pass' },
  olho_lapidador: { pt: 'Olho de Lapidador', en: 'Lapidary Eye' },
  veia_ouro: { pt: 'Veia de Ouro', en: 'Gold Vein' },
  grito_guerra: { pt: 'Grito de Guerra', en: 'War Cry' },
  golpe_brutal: { pt: 'Golpe Brutal', en: 'Brutal Strike' },
  matilha: { pt: 'Matilha', en: 'Pack' },
  fortuna: { pt: 'Fortuna', en: 'Fortune' },
  brecha: { pt: 'Brecha', en: 'Breach' },
};

const ABILITY_EFFECTS: Record<string, Bilingual> = {
  bateria_extra: {
    pt: '−1% energia gasta (próprio)/nível',
    en: '−1% energy spent (self)/level',
  },
  caca_hero: {
    pt: '+5% dano na Jaula/nível (não modelado)',
    en: '+5% Cage damage/level (not modeled)',
  },
  marcha_acelerada: {
    pt: '+0.185% velocidade do TIME/nível',
    en: '+0.185% TEAM speed/level',
  },
  pressagio_mortal: {
    pt: '+5.714% chance de crítico do TIME/nível (% da base)',
    en: '+5.714% TEAM crit chance/level (% of base)',
  },
  fantasma: {
    pt: 'atravessa rocha; +0.05% Ataque de passagem/nível (não modelado)',
    en: 'phases through rock; +0.05% Attack from passage/level (not modeled)',
  },
  ponta_diamante: {
    pt: '+1 Penetração (pontos)/nível',
    en: '+1 Penetration (points)/level',
  },
  misericordia: {
    pt: 'executa rocha < 1.25%/nível',
    en: 'executes rock < 1.25%/level',
  },
  explosao_ampla: {
    pt: '+0.1 raio da explosão/nível',
    en: '+0.1 explosion radius/level',
  },
  contra_relogio: {
    pt: '+2% Ataque em fase de tempo/nível',
    en: '+2% Attack in timed phase/level',
  },
  olho_clinico: {
    pt: '+4.286% chance de crítico/nível (% da base, altera atributos)',
    en: '+4.286% crit chance/level (% of base, affects stats)',
  },
  detonacao_dupla: {
    pt: '+1.5% chance de 2ª explosão (50% dano)/nível',
    en: '+1.5% chance of 2nd blast (50% damage)/level',
  },
  folego_mineiro: {
    pt: '−1% energia gasta do TIME/nível',
    en: '−1% TEAM energy spent/level',
  },
  passagem_bastao: {
    pt: '+4% de Dano ao ENTRAR no rodízio (dura 120s)/nível (não modelado)',
    en: '+4% Damage on ENTERING rotation (lasts 120s)/level (not modeled)',
  },
  olho_lapidador: {
    pt: '+2.5% chance de baú subir raridade/nível (loot)',
    en: '+2.5% chance chest upgrades rarity/level (loot)',
  },
  veia_ouro: {
    pt: '+2% ouro (próprio)/nível, +40% no teto (loot)',
    en: '+2% gold (self)/level, +40% at cap (loot)',
  },
  grito_guerra: {
    pt: '+1% Ataque do TIME/nível',
    en: '+1% TEAM Attack/level',
  },
  golpe_brutal: {
    pt: '+4% dano crítico/nível (valor fixo, altera atributos)',
    en: '+4% crit damage/level (flat, affects stats)',
  },
  matilha: {
    pt: '+2% dano por aliado na rotação/nível, +40% no teto (não modelado)',
    en: '+2% dmg per ally in rotation/level, +40% at cap (not modeled)',
  },
  fortuna: {
    pt: '+0.5% ouro do TIME/nível, +10% no teto (loot, aura capada)',
    en: '+0.5% TEAM gold/level, +10% at cap (loot, capped aura)',
  },
  brecha: {
    pt: '+1 Penetração/nível, +20 no teto (herói na ficha: não comprovado)',
    en: '+1 Penetration/level, +20 at cap (on-sheet status not proven)',
  },
};

const RARITY_LABELS: Record<RarityKey, Bilingual> = {
  Comum: { pt: 'Comum', en: 'Common' },
  Incomum: { pt: 'Incomum', en: 'Uncommon' },
  Raro: { pt: 'Raro', en: 'Rare' },
  Épico: { pt: 'Épico', en: 'Epic' },
  Lendária: { pt: 'Lendária', en: 'Legendary' },
  Mítico: { pt: 'Mítico', en: 'Mythic' },
};

const ITEM_RARITY_LABELS: Record<number, Bilingual> = {
  0: { pt: 'Comum', en: 'Common' },
  1: { pt: 'Incomum', en: 'Uncommon' },
  2: { pt: 'Raro', en: 'Rare' },
  3: { pt: 'Épico', en: 'Epic' },
  4: { pt: 'Lendária', en: 'Legendary' },
  5: { pt: 'Mítico', en: 'Mythic' },
};

const HOUSE_LABELS: Record<number, Bilingual> = {
  0: { pt: 'Casa I (Incomum)', en: 'House I (Uncommon)' },
  1: { pt: 'Casa II (Raro)', en: 'House II (Rare)' },
  2: { pt: 'Casa III (Épico)', en: 'House III (Epic)' },
  3: { pt: 'Casa IV (Lendária)', en: 'House IV (Legendary)' },
  4: { pt: 'Casa V (Mítico)', en: 'House V (Mythic)' },
};

const SLOT_LABELS: Record<Slot, Bilingual> = {
  arma: { pt: 'Arma', en: 'Weapon' },
  elmo: { pt: 'Elmo', en: 'Helm' },
  anel: { pt: 'Anel', en: 'Ring' },
  amuleto: { pt: 'Amuleto', en: 'Amulet' },
  peito: { pt: 'Peito', en: 'Chest' },
  calca: { pt: 'Calça', en: 'Legs' },
  luva: { pt: 'Luva', en: 'Gloves' },
  bota: { pt: 'Bota', en: 'Boots' },
};

const STAT_LABEL_MAP: Record<StatKey, Bilingual> = {
  energy: { pt: 'Energia', en: 'Energy' },
  attack: { pt: 'Ataque', en: 'Attack' },
  critDmg: { pt: 'Dano Crítico', en: 'Crit Damage' },
  speed: { pt: 'Velocidade', en: 'Speed' },
  critChance: { pt: 'Chance de Crítico', en: 'Crit Chance' },
  penetration: { pt: 'Penetração', en: 'Penetration' },
  cdr: { pt: 'Red. de Cooldown', en: 'CDR' },
};

const ITEM_STAT_LABELS: Record<string, Bilingual> = {
  dmg: { pt: 'Dano', en: 'Damage' },
  energia: { pt: 'Energia', en: 'Energy' },
  velocidade: { pt: 'Velocidade', en: 'Speed' },
  sorte: { pt: 'Sorte', en: 'Luck' },
  crit: { pt: 'Crítico', en: 'Crit' },
  penetracao: { pt: 'Penetração', en: 'Penetration' },
  cooldown: { pt: 'Cooldown', en: 'Cooldown' },
};

const PROP_LABELS: Record<string, Bilingual> = {
  bush: { pt: 'Arbusto', en: 'Bush' },
  stone: { pt: 'Pedra', en: 'Stone' },
  box: { pt: 'Caixa', en: 'Box' },
  copper_mine: { pt: 'Mina de Cobre', en: 'Copper Mine' },
  iron_mine: { pt: 'Mina de Ferro', en: 'Iron Mine' },
  gold_ore: { pt: 'Minério de Ouro', en: 'Gold Ore' },
  minerio_mithril: { pt: 'Minério de Mithril', en: 'Mithril Ore' },
  blue_crystal: { pt: 'Cristal Azul', en: 'Blue Crystal' },
  crystal_rubi: { pt: 'Cristal Rubi', en: 'Ruby Crystal' },
  purple_crystal: { pt: 'Cristal Roxo', en: 'Purple Crystal' },
};

/** Catalog set slugs → display names. Keys stay English ids. */
const SET_LABELS: Record<string, Bilingual> = {
  ash: { pt: 'Cinzas', en: 'Ash' },
  autumn: { pt: 'Outono', en: 'Autumn' },
  brass: { pt: 'Latão', en: 'Brass' },
  clay: { pt: 'Argila', en: 'Clay' },
  coal: { pt: 'Carvão', en: 'Coal' },
  crimson: { pt: 'Carmesim', en: 'Crimson' },
  desert: { pt: 'Deserto', en: 'Desert' },
  dune: { pt: 'Duna', en: 'Dune' },
  earth: { pt: 'Terra', en: 'Earth' },
  ember: { pt: 'Brasa', en: 'Ember' },
  forest: { pt: 'Floresta', en: 'Forest' },
  glacier: { pt: 'Geleira', en: 'Glacier' },
  gold: { pt: 'Ouro', en: 'Gold' },
  iron: { pt: 'Ferro', en: 'Iron' },
  jade: { pt: 'Jade', en: 'Jade' },
  // The three nv280/290/300 sets added by the 2026-08-15 patch. The wiki publishes set SLUGS
  // only (`itens.defs[].set`), never display names, so these PT strings are translations, not
  // captures — confirm them against the in-game item names before they ship to players.
  magma: { pt: 'Magma', en: 'Magma' },
  midnight: { pt: 'Meia-noite', en: 'Midnight' },
  obsidian: { pt: 'Obsidiana', en: 'Obsidian' },
  platinum: { pt: 'Platina', en: 'Platinum' },
  sandstorm: { pt: 'Tempestade de Areia', en: 'Sandstorm' },
  shadow: { pt: 'Sombra', en: 'Shadow' },
  silver: { pt: 'Prata', en: 'Silver' },
  steel: { pt: 'Aço', en: 'Steel' },
  sunfire: { pt: 'Fogo Solar', en: 'Sunfire' },
  sunset: { pt: 'Pôr do Sol', en: 'Sunset' },
  topaz: { pt: 'Topázio', en: 'Topaz' },
  toxic: { pt: 'Tóxico', en: 'Toxic' },
  venom: { pt: 'Veneno', en: 'Venom' },
  void: { pt: 'Vazio', en: 'Void' },
  wooden: { pt: 'Madeira', en: 'Wooden' },
};

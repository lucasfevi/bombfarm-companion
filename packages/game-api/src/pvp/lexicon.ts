/**
 * The PVP wire lexicon: the duel result the client receives when it presses Challenge, the film it
 * fetches right after, the PVP state the client polls (the same object the result carries as
 * `estado`), and the ranking it fetches when the player opens the leaderboard. The bodies mix
 * Portuguese keys (`venceu`, `fase`, `filme`) with English ones (`slots`, `squad`, `hz`), and this
 * table is the one place that vocabulary is translated into this codebase's own English domain
 * field names — the same job `../rotation/lexicon.ts` does for `/rotation`. `identify.ts` and
 * `parse.ts` reference a wire token only through {@link wireKey}, never as an inline literal.
 *
 * The film's per-frame keys (`t`, `hp`, `da`, `dd`, `k`, `c`, `h`, `b`, `x`) are declared for
 * documentation: the desktop keeps the film whole and reads only its header, so nothing here
 * decodes a frame yet.
 */

import { createWireKeyLookup, type WireLexiconEntry } from '../wire-lexicon.js';

export type PvpWireSymbol =
  | 'won'
  | 'phase'
  | 'filmId'
  | 'rooms'
  | 'seconds'
  | 'attacker'
  | 'defender'
  | 'sideName'
  | 'sideHeroes'
  | 'sideScore'
  | 'pointsBefore'
  | 'pointsAfter'
  | 'duelsLeft'
  | 'duelsMax'
  | 'prize'
  | 'state'
  | 'statePoints'
  | 'stateTier'
  | 'stateTierNumber'
  | 'stateTierNext'
  | 'stateSlots'
  | 'stateSquad'
  | 'squadSlot'
  | 'squadHeroId'
  | 'stateDuelsUsed'
  | 'stateEnabled'
  | 'stateSlotsMax'
  | 'stateSlotsAll'
  | 'stateActiveTier'
  | 'stateLevel'
  | 'stateLevels'
  | 'stateMaxLevel'
  | 'stateUpgradeCost'
  | 'upgradeCostQuantity'
  | 'upgradeCostRarity'
  | 'rankingBy'
  | 'rankingTop'
  | 'rankingMe'
  | 'rankingRank'
  | 'rankingName'
  | 'rankingValue'
  | 'rankingHeroSkin'
  | 'rankingBadges'
  | 'filmIdField'
  | 'filmVisualPhase'
  | 'filmHz'
  | 'filmAttackerHeroes'
  | 'filmDefenderHeroes'
  | 'filmHeroSkill'
  | 'filmHeroT'
  | 'filmFrames'
  | 'frameT'
  | 'frameHp'
  | 'frameAttackerDamage'
  | 'frameDefenderDamage'
  | 'frameK'
  | 'frameC'
  | 'frameHeroes'
  | 'frameBombs'
  | 'frameX'
  | 'bombSide'
  | 'bombCell'
  | 'bombRadius'
  | 'bombFuseLeft'
  | 'bombFuseTotal'
  | 'heroSide'
  | 'heroSlot'
  | 'heroCell'
  | 'heroState';

const KEY_ENTRIES: ReadonlyArray<WireLexiconEntry & { readonly symbol: PvpWireSymbol }> = [
  { symbol: 'won', wireToken: 'venceu', kind: 'key', domainField: 'won', description: 'Whether the attacker won the duel.', origin: 'portuguese' },
  { symbol: 'phase', wireToken: 'fase', kind: 'key', domainField: 'phase', description: 'On a result: the combat phase the duel was fought in, not the tier floor. On the state and the film: see the row.', origin: 'portuguese' },
  { symbol: 'filmId', wireToken: 'filme', kind: 'key', domainField: 'filmId', description: 'The film id the server issued for the duel; 0 when none was.', origin: 'portuguese' },
  { symbol: 'rooms', wireToken: 'salas', kind: 'key', domainField: 'rooms', description: 'Room clears over the duel.', origin: 'portuguese' },
  { symbol: 'seconds', wireToken: 'segundos', kind: 'key', domainField: 'seconds', description: 'Duel length in seconds (60 observed).', origin: 'portuguese' },
  { symbol: 'attacker', wireToken: 'atacante', kind: 'key', domainField: 'attacker', description: 'The side that pressed Challenge — the player.', origin: 'portuguese' },
  { symbol: 'defender', wireToken: 'defensor', kind: 'key', domainField: 'defender', description: 'The side that was challenged — the opponent.', origin: 'portuguese' },
  { symbol: 'sideName', wireToken: 'nome', kind: 'key', domainField: 'name', description: "A side's display name.", origin: 'portuguese' },
  { symbol: 'sideHeroes', wireToken: 'herois', kind: 'key', domainField: 'heroes', description: 'How many heroes a side fielded.', origin: 'portuguese' },
  { symbol: 'sideScore', wireToken: 'dano', kind: 'key', domainField: 'score', description: "A side's score: the HP it tore off the other side.", origin: 'portuguese' },
  { symbol: 'pointsBefore', wireToken: 'pontos_antes', kind: 'key', domainField: 'pointsBefore', description: 'PVP points before the duel settled.', origin: 'portuguese' },
  { symbol: 'pointsAfter', wireToken: 'pontos_depois', kind: 'key', domainField: 'pointsAfter', description: 'PVP points after the duel settled.', origin: 'portuguese' },
  { symbol: 'duelsLeft', wireToken: 'duelos_restantes', kind: 'key', domainField: 'duelsLeft', description: 'Duels left in the quota.', origin: 'portuguese' },
  { symbol: 'duelsMax', wireToken: 'duelos_max', kind: 'key', domainField: 'duelsMax', description: 'The duel quota.', origin: 'portuguese' },
  { symbol: 'prize', wireToken: 'premio', kind: 'key', domainField: 'prize', description: 'Whether the rune chest landed (`won`) or was lost to a full bag (`lost`); names neither on a duel that issued no chest — a lost one.', origin: 'portuguese' },
  { symbol: 'state', wireToken: 'estado', kind: 'key', domainField: 'state', description: 'The full PVP state after the duel.', origin: 'portuguese' },
  { symbol: 'statePoints', wireToken: 'pontos', kind: 'key', domainField: 'points', description: 'Current PVP points.', origin: 'portuguese' },
  { symbol: 'stateTier', wireToken: 'faixa', kind: 'key', domainField: 'tier', description: 'The tier token (`r1`…`r6`).', origin: 'portuguese' },
  { symbol: 'stateTierNumber', wireToken: 'faixa_num', kind: 'key', domainField: 'tierNumber', description: 'The tier as a number.', origin: 'portuguese' },
  { symbol: 'stateTierNext', wireToken: 'faixa_prox', kind: 'key', domainField: 'tierNext', description: 'Points to the next tier.', origin: 'portuguese' },
  { symbol: 'stateSlots', wireToken: 'slots', kind: 'key', domainField: 'slots', description: 'Squad slots available.', origin: 'english' },
  { symbol: 'stateSquad', wireToken: 'squad', kind: 'key', domainField: 'squad', description: 'The squad, one entry per filled slot.', origin: 'english' },
  { symbol: 'squadSlot', wireToken: 'slot', kind: 'key', domainField: 'slot', description: 'A squad entry’s slot index.', origin: 'english' },
  { symbol: 'squadHeroId', wireToken: 'hero_id', kind: 'key', domainField: 'heroId', description: 'A squad entry’s hero id.', origin: 'english' },
  { symbol: 'stateDuelsUsed', wireToken: 'duelos_usados', kind: 'key', domainField: 'duelsUsed', description: 'Duels spent from the quota.', origin: 'portuguese' },
  { symbol: 'stateEnabled', wireToken: 'enabled', kind: 'key', domainField: 'enabled', description: 'Whether PVP is open to the account.', origin: 'english' },
  { symbol: 'stateSlotsMax', wireToken: 'slots_max', kind: 'key', domainField: 'slotsMax', description: 'Squad slots at the top of the ladder.', origin: 'english' },
  { symbol: 'stateSlotsAll', wireToken: 'slots_all', kind: 'key', domainField: 'slotsAll', description: 'Squad slots granted at each squad level.', origin: 'english' },
  { symbol: 'stateActiveTier', wireToken: 'active_tier', kind: 'key', domainField: 'activeTier', description: 'Meaning not established.', origin: 'english' },
  { symbol: 'stateLevel', wireToken: 'level', kind: 'key', domainField: 'level', description: 'Squad level of the highest rarity house. Meaning not fully established.', origin: 'english' },
  { symbol: 'stateLevels', wireToken: 'levels', kind: 'key', domainField: 'levels', description: 'Per-rarity squad house levels.', origin: 'english' },
  { symbol: 'stateMaxLevel', wireToken: 'max_level', kind: 'key', domainField: 'maxLevel', description: 'The squad house level cap (20 observed).', origin: 'english' },
  { symbol: 'stateUpgradeCost', wireToken: 'upgrade_cost', kind: 'key', domainField: 'upgradeCost', description: 'The time items the next squad upgrade costs, per rarity.', origin: 'english' },
  { symbol: 'upgradeCostQuantity', wireToken: 'qtd', kind: 'key', domainField: 'quantity', description: 'How many of a rarity the upgrade costs.', origin: 'portuguese' },
  { symbol: 'upgradeCostRarity', wireToken: 'rarity', kind: 'key', domainField: 'rarity', description: 'The rarity an upgrade cost entry is priced in.', origin: 'english' },
  { symbol: 'rankingBy', wireToken: 'by', kind: 'key', domainField: 'by', description: 'Which leaderboard the body is: `pvp`, `hero` or `power`.', origin: 'english' },
  { symbol: 'rankingTop', wireToken: 'top', kind: 'key', domainField: 'top', description: 'The top hundred, one entry per rank.', origin: 'english' },
  { symbol: 'rankingMe', wireToken: 'me', kind: 'key', domainField: 'me', description: "The player's own entry, whatever their rank.", origin: 'english' },
  { symbol: 'rankingRank', wireToken: 'rank', kind: 'key', domainField: 'rank', description: 'A leaderboard position, 1 at the top.', origin: 'english' },
  { symbol: 'rankingName', wireToken: 'name', kind: 'key', domainField: 'name', description: "An entry's display name.", origin: 'english' },
  { symbol: 'rankingValue', wireToken: 'value', kind: 'key', domainField: 'value', description: 'The figure the board ranks by, as a string of digits (PVP points on the `pvp` board).', origin: 'english' },
  { symbol: 'rankingHeroSkin', wireToken: 'hero_skin', kind: 'key', domainField: 'heroSkin', description: "An entry's shown skin index.", origin: 'english' },
  { symbol: 'rankingBadges', wireToken: 'badges', kind: 'key', domainField: 'badges', description: "An entry's badge tokens.", origin: 'english' },
  { symbol: 'filmIdField', wireToken: 'id', kind: 'key', domainField: 'filmId', description: 'The film’s own id — the value the result named in `filme`.', origin: 'english' },
  { symbol: 'filmVisualPhase', wireToken: 'fase_visual', kind: 'key', domainField: 'visualPhase', description: 'The phase the film draws its room as.', origin: 'portuguese' },
  { symbol: 'filmHz', wireToken: 'hz', kind: 'key', domainField: 'hz', description: 'Frames per second the film was sampled at (12 observed).', origin: 'english' },
  { symbol: 'filmAttackerHeroes', wireToken: 'a', kind: 'key', domainField: 'attackerHeroes', description: 'Per-hero attacker entries, index = squad slot.', origin: 'english' },
  { symbol: 'filmDefenderHeroes', wireToken: 'd', kind: 'key', domainField: 'defenderHeroes', description: 'Per-hero defender entries, index = squad slot.', origin: 'english' },
  { symbol: 'filmHeroSkill', wireToken: 'sk', kind: 'key', domainField: 'skill', description: 'A film hero entry’s skill field. Meaning not established.', origin: 'english' },
  { symbol: 'filmHeroT', wireToken: 't', kind: 'key', domainField: 't', description: 'A film hero entry’s `t` field. Meaning not established.', origin: 'english' },
  { symbol: 'filmFrames', wireToken: 'q', kind: 'key', domainField: 'frames', description: 'The film’s frames (721 observed for a 60 s duel at 12 Hz).', origin: 'english' },
  { symbol: 'frameT', wireToken: 't', kind: 'key', domainField: 'time', description: 'Frame time.', origin: 'english' },
  { symbol: 'frameHp', wireToken: 'hp', kind: 'key', domainField: 'hp', description: 'Room HP at the frame.', origin: 'english' },
  { symbol: 'frameAttackerDamage', wireToken: 'da', kind: 'key', domainField: 'attackerDamage', description: 'Attacker damage so far.', origin: 'english' },
  { symbol: 'frameDefenderDamage', wireToken: 'dd', kind: 'key', domainField: 'defenderDamage', description: 'Defender damage so far.', origin: 'english' },
  { symbol: 'frameK', wireToken: 'k', kind: 'key', domainField: 'k', description: 'Optional per-frame field. Meaning not established.', origin: 'english' },
  { symbol: 'frameC', wireToken: 'c', kind: 'key', domainField: 'c', description: 'Per-frame field. Meaning not established.', origin: 'english' },
  { symbol: 'frameHeroes', wireToken: 'h', kind: 'key', domainField: 'heroes', description: 'Per-frame hero entries.', origin: 'english' },
  { symbol: 'frameBombs', wireToken: 'b', kind: 'key', domainField: 'bombs', description: 'Per-frame bomb entries.', origin: 'english' },
  { symbol: 'frameX', wireToken: 'x', kind: 'key', domainField: 'x', description: 'Per-frame entities (one observed, with `a`, `k` and an `hp` on a 0–255 scale). Meaning not established.', origin: 'english' },
  { symbol: 'bombSide', wireToken: 'l', kind: 'key', domainField: 'side', description: 'A bomb’s or hero’s side: 0 attacker, 1 defender.', origin: 'english' },
  { symbol: 'bombCell', wireToken: 'ce', kind: 'key', domainField: 'cell', description: 'The cell a bomb sits in, or a hero stands on.', origin: 'english' },
  { symbol: 'bombRadius', wireToken: 'r', kind: 'key', domainField: 'radius', description: 'A bomb’s blast radius in cells.', origin: 'english' },
  { symbol: 'bombFuseLeft', wireToken: 'f', kind: 'key', domainField: 'fuseLeft', description: 'Seconds of fuse a bomb has left at the frame.', origin: 'english' },
  { symbol: 'bombFuseTotal', wireToken: 'ft', kind: 'key', domainField: 'fuseTotal', description: 'A bomb’s whole fuse; with the side and cell it identifies one bomb across frames.', origin: 'english' },
  { symbol: 'heroSide', wireToken: 'l', kind: 'key', domainField: 'side', description: 'A frame hero’s side: 0 attacker, 1 defender.', origin: 'english' },
  { symbol: 'heroSlot', wireToken: 'i', kind: 'key', domainField: 'slot', description: 'A frame hero’s squad slot.', origin: 'english' },
  { symbol: 'heroCell', wireToken: 'ce', kind: 'key', domainField: 'cell', description: 'The cell a frame hero stands on.', origin: 'english' },
  { symbol: 'heroState', wireToken: 'st', kind: 'key', domainField: 'state', description: 'A frame hero’s state, 0–5 observed. Meaning not established.', origin: 'english' },
];

const ENUM_ENTRIES: readonly WireLexiconEntry[] = [
  { symbol: 'prizeWon', wireToken: 'won', kind: 'enum_value', domainField: 'prize', description: 'The rune chest landed in the bag.', origin: 'english' },
  { symbol: 'prizeLost', wireToken: 'lost', kind: 'enum_value', domainField: 'prize', description: 'The rune chest was lost to a full bag.', origin: 'english' },
  { symbol: 'rankingByPvp', wireToken: 'pvp', kind: 'enum_value', domainField: 'by', description: 'The PVP points leaderboard.', origin: 'english' },
  { symbol: 'rankingByHero', wireToken: 'hero', kind: 'enum_value', domainField: 'by', description: 'The strongest-hero leaderboard.', origin: 'english' },
  { symbol: 'rankingByPower', wireToken: 'power', kind: 'enum_value', domainField: 'by', description: 'The total-power leaderboard.', origin: 'english' },
];

/** The one board this app reads a position from. */
export const PVP_RANKING_BOARD = 'pvp';

export const PVP_WIRE_LEXICON: readonly WireLexiconEntry[] = [...KEY_ENTRIES, ...ENUM_ENTRIES];

export const wireKey: (symbol: PvpWireSymbol) => string = createWireKeyLookup(KEY_ENTRIES, 'pvp lexicon');

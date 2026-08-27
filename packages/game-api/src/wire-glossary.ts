/**
 * Combines every declared wire lexicon — `/rotation` and the live combat websocket, so far — into
 * one `PORTUGUESE_WIRE_TOKENS` list and one `docs/wire-vocabulary.md` document. Adding a third wire
 * boundary later means declaring its own lexicon on `./wire-lexicon.js`'s machinery and adding one
 * line in each list below; nothing else here changes.
 */

import { LIVE_FRAME_WIRE_LEXICON } from './live-frame/lexicon.js';
import { ROTATION_WIRE_LEXICON } from './rotation/lexicon.js';
import { glossaryTable, portugueseWireTokens, type WireLexiconEntry } from './wire-lexicon.js';

/** Every Portuguese-origin wire token declared across every lexicon. The vocabulary guard's
 *  forbidden-identifier pattern is built from exactly this list, never from a hand-written
 *  literal, so the guard cannot drift from the tables that are supposed to be its only source of
 *  truth. */
export const PORTUGUESE_WIRE_TOKENS: readonly string[] = [
  ...portugueseWireTokens(ROTATION_WIRE_LEXICON),
  ...portugueseWireTokens(LIVE_FRAME_WIRE_LEXICON),
];

function boundarySection(
  title: string,
  intro: string,
  lexicon: readonly WireLexiconEntry[],
  enumTitle: string,
): readonly string[] {
  const keyRows = lexicon.filter((entry) => entry.kind === 'key');
  const enumRows = lexicon.filter((entry) => entry.kind === 'enum_value');

  return [
    `## ${title}`,
    '',
    intro,
    '',
    ...glossaryTable('Keys', keyRows),
    ...(enumRows.length > 0 ? glossaryTable(enumTitle, enumRows) : []),
  ];
}

/**
 * Renders every declared lexicon as the `docs/wire-vocabulary.md` markdown body. Pure — no
 * filesystem access, no clock — so `tools/generate-wire-glossary.mjs` can write its return value
 * verbatim, and the staleness test can compare it byte-for-byte against the committed doc.
 */
export function renderWireGlossary(): string {
  const header = [
    '# Wire vocabulary',
    '',
    '<!-- generated — do not edit by hand, run `pnpm generate:wire-vocabulary` -->',
    '',
    'This is the one place wire vocabulary — abbreviated keys, Portuguese-origin identifiers, or ' +
      "both — is translated into this codebase's own English domain field names. Each boundary " +
      'below covers only the traffic this codebase actually decodes; neither table inventories the ' +
      "rest of the game's wire protocol.",
    '',
  ];

  const rotation = boundarySection(
    '`/rotation` route',
    "`/rotation`'s wire body mixes Portuguese and English keys (`casa` beside `cycle_secs`, " +
      '`energia_atual` beside `battle_allowed`) — see `packages/game-api/src/rotation/lexicon.ts`.',
    ROTATION_WIRE_LEXICON,
    '`state` values',
  );

  const liveFrame = boundarySection(
    'Live combat frame (websocket `snap` tick)',
    'The combat websocket packs its payload into single-letter and abbreviated keys beside a ' +
      'handful of Portuguese-origin ones (`jaula_*`, `seca_secs`) — see ' +
      '`packages/game-api/src/live-frame/lexicon.ts`. Several entries are declared for ' +
      'documentation only; the decoder does not yet read every one.',
    LIVE_FRAME_WIRE_LEXICON,
    '`t` values',
  );

  return [...header, ...rotation, '', ...liveFrame].join('\n').trimEnd() + '\n';
}

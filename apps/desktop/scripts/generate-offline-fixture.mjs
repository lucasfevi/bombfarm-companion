import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spliceCaptureHeroes } from './splice-capture.mjs';

/**
 * Regenerates `tests/fixtures/account-offline.json`, the account `pnpm dev:offline` runs against.
 *
 *   node scripts/generate-offline-fixture.mjs
 *
 * Built from two committed captures, and nothing else:
 *
 * - a **save export** supplies `account`, `heroes`, `skills` and `items`. Its section shapes are
 *   the same ones the five routes return, so no translation is needed. It is post-patch, which is
 *   what keeps its gear agreeing with the current `catalog.setsByLevel` — the pre-patch API
 *   calibration bodies do not, and a fixture built from those has to be excluded from
 *   `fixture-set-level-agreement.test.ts` rather than satisfying it.
 * - the **replay capture** supplies who is on the field and each of their energy fractions, so the
 *   account and the frames the Live screen folds onto it describe one account at one moment.
 *
 * The `casa` section is assembled here rather than copied, because a save export carries only the
 * house object while `/rotation` projects its *whole* body — per-hero rotation state included —
 * into that section. Every per-hero field written below comes from one of the two captures; the
 * ones neither carries (`energia_atual`, `energia_max`, the rescue counts) are omitted rather
 * than invented, which `normalizeRotation` already treats as optional.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(desktopRoot, '..', '..');

const SAVE_EXPORT = path.join(
  repoRoot,
  'packages',
  'domain',
  'tests',
  'fixtures',
  'sheet-math',
  'save-20260823-13heroes-crit-points.json',
);
const CAPTURE = path.join(desktopRoot, 'src', 'main', 'live-source', 'fixtures', 'live-capture.bfcc');
const DESTINATION = path.join(desktopRoot, 'tests', 'fixtures', 'account-offline.json');
const CAPS_DESTINATION = path.join(desktopRoot, 'tests', 'fixtures', 'account-offline-caps.json');
const CAPS_CAPTURE = path.join(desktopRoot, 'src', 'main', 'live-source', 'fixtures', 'live-capture-caps.bfcc');

/**
 * The three heroes the `caps` scenario takes off the field — the last three to appear, so the six
 * that remain keep their positions and the roster re-key below is unchanged for them.
 *
 * Narrowing the field is the only way to see the field's own upgrade hint: `field_size` has to sit
 * under the game's ceiling of nine, and the live tap's on-field set overrules the snapshot, so the
 * frames have to agree or the screen reads "9/6".
 */
const CAPS_DROPPED_HERO_IDS = ['73099', '74555', '76184'];

/** The save export's own `generated_at`, as an ISO instant — fixed, so regenerating is a no-op diff. */
const CAPTURED_AT = '2026-08-23T00:00:00.000Z';

/**
 * Walks the `.bfcc` container (5-byte header, then ctxType(1) ctxLength(4 LE) ctx
 * payloadLength(4 LE) payload) and reads each record's frame JSON directly. Parsed here rather
 * than imported because `capture-format.ts` is bundled into the Electron main output rather than
 * emitted per module.
 */
function readCapture(bytes = readFileSync(CAPTURE)) {
  const order = [];
  const energyById = new Map();

  let offset = 5;
  while (offset + 5 <= bytes.length) {
    const ctxLength = bytes.readUInt32LE(offset + 1);
    const payloadStart = offset + 5 + ctxLength + 4;
    if (payloadStart > bytes.length) break;
    const payloadLength = bytes.readUInt32LE(offset + 5 + ctxLength);
    const payloadEnd = payloadStart + payloadLength;
    if (payloadEnd > bytes.length) break;

    const payload = bytes.subarray(payloadStart, payloadEnd);
    const braceAt = payload.indexOf(0x7b);
    if (braceAt !== -1) {
      try {
        const frame = JSON.parse(payload.subarray(braceAt).toString('utf8'));
        for (const hero of frame.heroes ?? []) {
          if (typeof hero?.id !== 'string') continue;
          if (!order.includes(hero.id)) order.push(hero.id);
          if (typeof hero.e === 'number') energyById.set(hero.id, hero.e);
        }
      } catch {
        // A record that is not a complete frame contributes nothing; the rest still do.
      }
    }
    offset = payloadEnd;
  }
  return { order, energyById };
}

/**
 * The whole fixture, as a pure value. Exported so `offline-fixture-drift.test.ts` can rebuild it
 * and compare against the committed file — the same shape `replay-stream-drift.test.ts` uses for
 * `replay-stream.bin`. Without that, a hand-edit of the JSON or a generator change without a
 * regeneration goes unnoticed.
 */
export function buildOfflineFixture(captureBytes = readFileSync(CAPTURE), { fieldSizeFromCapture = false } = {}) {
  const save = JSON.parse(readFileSync(SAVE_EXPORT, 'utf8'));
  const { order: replayIds, energyById } = readCapture(captureBytes);

  /**
   * The save's heroes and the capture's heroes are different accounts, so the roster is re-keyed
   * onto the capture's ids in first-appearance order. Without it the Live screen counts the
   * capture's heroes on the field and lists none of them, the roster join having found nothing.
   * Only the opaque id is substituted; the capture's own bytes are never touched.
   */
  const roster = save.heroes ?? [];
  const replayIdSet = new Set(replayIds);

  /**
   * On-field membership is decided by POSITION, not by id: the first `replayIds.length` heroes take
   * the capture's ids and are the ones it shows fighting. Deciding by id membership instead counts
   * any hero whose own save id happens to equal one of the capture's — which both overstates the
   * field and leaves two heroes sharing an id. A retained id that would collide is suffixed for the
   * same reason; every id in the roster has to be distinct for the rotation join to mean anything.
   */
  const rekeyedRoster = roster.map((hero, index) => {
    const replacement = replayIds[index];
    const original = String(hero.id);
    const id = replacement ?? (replayIdSet.has(original) ? `${original}-roster` : original);
    return { ...hero, id, in_field: index < replayIds.length };
  });

  /**
   * `secondsRemaining` is `energyFraction * energyMax / drainPerSecond`, so a rotation entry with a
   * fraction and no maximum yields no countdown at all — the screen lists the hero and prints "not
   * available" beside it. The maximum is the save's own `stats.energia`, and the fraction is the
   * capture's observed `e`, so both halves of every on-field hero's energy are captured values.
   *
   * The four heroes the capture never shows are resting, and neither capture records a resting
   * hero's energy. Rather than invent a number, they reuse the capture's own observed fractions,
   * cycled — real values, reassigned. It is the one place this fixture puts a measurement somewhere
   * it was not measured, and it is why a recovery countdown here is worth looking at only as
   * layout, never as a reading.
   */
  const observedFractions = replayIds
    .map((id) => energyById.get(id))
    .filter((fraction) => fraction !== undefined);

  const rotationHeroes = rekeyedRoster.map((hero, index) => {
    const onField = hero.in_field;
    const restingFraction = observedFractions[index % Math.max(1, observedFractions.length)];
    const energyFraction = onField ? energyById.get(hero.id) : restingFraction;
    const energyMax = typeof hero.stats?.energia === 'number' ? hero.stats.energia : undefined;

    return {
      id: hero.id,
      level: hero.level,
      ...(energyFraction !== undefined ? { energia_pct: energyFraction } : {}),
      ...(energyMax !== undefined ? { energia_max: energyMax } : {}),
      ...(energyMax !== undefined && energyFraction !== undefined
        ? { energia_atual: energyMax * energyFraction }
        : {}),
      state: onField ? 'EM_CAMPO' : 'DESCANSANDO',
      in_field: onField,
      in_casa: !onField,
      recovering: !onField,
      battle_allowed: Boolean(hero.battle_allowed),
    };
  });

  const resolved = { status: 'resolved', capturedAt: CAPTURED_AT };

  const payload = {
    account: save.account,
    heroes: rekeyedRoster,
    skills: save.skills,
    casa: {
      // A derived capture narrows the field on purpose, and the guard below is what keeps the two
      // halves agreeing — so its own hero count is the field size, not the save's skill state.
      field_size: fieldSizeFromCapture ? replayIds.length : (save.skills?.field_slots ?? replayIds.length),
      heroes: rotationHeroes,
      casa: save.casa,
    },
    items: save.items,
    fidelity: {
      account: resolved,
      heroes: resolved,
      skills: resolved,
      casa: resolved,
      items: resolved,
    },
  };

  /**
   * The two halves of "who is fighting" come from different places — `field_size` from the save's
   * skill state, membership from the capture's own hero count — and they agree today at nine. When
   * they last disagreed the field list visibly alternated between the rotation's answer and the
   * capture's, because every rotation ingest rebuilds the field from the rotation's on-field set.
   * A re-capture with a different count would reintroduce that silently, so it fails here instead.
   */
  const onFieldCount = rotationHeroes.filter((hero) => hero.in_field).length;
  if (onFieldCount !== payload.casa.field_size) {
    throw new Error(
      `generate-offline-fixture: the capture shows ${String(onFieldCount)} heroes on the field but ` +
        `field_size is ${String(payload.casa.field_size)}. These must agree, or the Live screen ` +
        'flickers between the rotation and the frames. Re-check the capture against the save export.',
    );
  }

  return payload;
}

/**
 * A second account, derived from the first, for looking at the rotation states the replay capture
 * cannot produce on its own.
 *
 * The base fixture puts nine heroes on the field and the remaining four at the house, all
 * recovering — so its Idle and Benched sections are empty on every run, and a rest-slot count that
 * is already at the ceiling shows no upgrade hint. Nothing about the Live screen's four states can
 * be looked at from it.
 *
 * WHAT IT CHANGES, and nothing else: the four off-field heroes are redealt across resting, idle
 * (one full and waiting for the field, one part-filled and waiting for a rest slot) and benched;
 * the house is moved down to Casa I, whose three rest slots sit under the ladder's own ceiling; a
 * daily skip allowance is added; and one hero's energy is removed outright.
 *
 * The field is narrowed to six by {@link buildCapsCapture}, so the field's own upgrade hint shows
 * too. That has to be done to the FRAMES, not to `field_size` alone: the live tap's on-field set
 * overrules the snapshot, so a fixture claiming a narrower field than its capture shows would read
 * "9/6" — the disagreement {@link buildOfflineFixture}'s own guard exists to prevent.
 *
 * Every energy figure here is one of the base fixture's own — reassigned, like its resting
 * fractions already are. Read this account as layout, never as a reading.
 */
export function buildCapsCapture() {
  return spliceCaptureHeroes(readFileSync(CAPTURE), CAPS_DROPPED_HERO_IDS);
}

export function buildCapsFixture() {
  const payload = buildOfflineFixture(buildCapsCapture(), { fieldSizeFromCapture: true });
  const casa = payload.casa.casa;

  /**
   * How the seven heroes left off the narrowed field are dealt across the other three states, in
   * the order the screen stacks them.
   *
   * The two Idle entries are the point of the exercise: `PRONTO` is full and waiting for a field
   * slot, while `DESCANSANDO` with `recovering: false` is part-filled and waiting for a rest slot.
   * They share one list, and only their energy tells them apart. One benched hero carries no
   * energy figure at all, which is the one case a bar has to say so rather than draw itself empty.
   */
  const REDEALT = [
    { state: 'DESCANSANDO', recovering: true, in_casa: true },
    { state: 'DESCANSANDO', recovering: true, in_casa: true },
    { state: 'DESCANSANDO', recovering: true, in_casa: true },
    { state: 'PRONTO', recovering: false, in_casa: false, energia_pct: 1 },
    { state: 'DESCANSANDO', recovering: false, in_casa: true, energia_pct: 0.17 },
    { state: 'NO_BANCO', recovering: false, in_casa: false, energia_pct: null },
    { state: 'NO_BANCO', recovering: false, in_casa: false },
  ];

  let redealt = 0;
  const heroes = payload.casa.heroes.map((hero) => {
    if (hero.in_field) return hero;
    const change = REDEALT[redealt];
    if (change === undefined) {
      throw new Error(
        `generate-offline-fixture: ${String(payload.casa.heroes.length)} heroes leave ` +
          `${String(payload.casa.heroes.filter((entry) => !entry.in_field).length)} off the field, ` +
          `but this deal covers ${String(REDEALT.length)}. Extend it rather than letting the tail ` +
          'repeat one state, which is how a scenario quietly stops showing what it exists to show.',
      );
    }
    redealt += 1;
    const { energia_pct: fraction, ...state } = change;
    const next = { ...hero, ...state };
    if (fraction === null) {
      // Energy the game never sent — the one case an energy bar has to say so rather than draw
      // itself empty, which would claim the hero has none.
      delete next.energia_pct;
      delete next.energia_atual;
      return next;
    }
    if (fraction === undefined) return next;
    return {
      ...next,
      energia_pct: fraction,
      ...(typeof next.energia_max === 'number' ? { energia_atual: next.energia_max * fraction } : {}),
    };
  });

  return {
    ...payload,
    casa: {
      ...payload.casa,
      heroes,
      casa: {
        ...casa,
        active_casa: 1,
        slots: 3,
        ...(Array.isArray(casa.cycle_secs_per_house) ? { cycle_secs: casa.cycle_secs_per_house[0] } : {}),
      },
      rescues_left: 3,
      rescues_max: 15,
    },
  };
}

/** The exact bytes the committed fixture should hold, newline included. */
export function serializeOfflineFixture() {
  return `${JSON.stringify(buildOfflineFixture(), null, 2)}
`;
}

/** @see serializeOfflineFixture */
export function serializeCapsFixture() {
  return `${JSON.stringify(buildCapsFixture(), null, 2)}
`;
}

export const OFFLINE_FIXTURE_PATH = DESTINATION;
export const CAPS_FIXTURE_PATH = CAPS_DESTINATION;
export const CAPS_CAPTURE_PATH = CAPS_CAPTURE;
export const CAPS_DROPPED_IDS = CAPS_DROPPED_HERO_IDS;

// Written only when run as a script, so importing this for the drift guard has no side effects.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const payload = buildOfflineFixture();
  writeFileSync(DESTINATION, serializeOfflineFixture(), 'utf8');

  const onField = payload.casa.heroes.filter((hero) => hero.in_field).length;
  console.log(`wrote ${DESTINATION}`);
  console.log(
    `  ${String(payload.heroes.length)} heroes (${String(onField)} on field), ` +
      `${String(payload.items.length)} items, field_size ${String(payload.casa.field_size)}`,
  );
  console.log(`  ${String(onField)} heroes re-keyed onto the replay capture's ids`);

  const capsCapture = buildCapsCapture();
  writeFileSync(CAPS_CAPTURE, capsCapture, null);
  console.log(`wrote ${CAPS_CAPTURE}`);
  console.log(`  ${String(CAPS_DROPPED_HERO_IDS.length)} heroes cut from every frame, every other byte verbatim`);

  const caps = buildCapsFixture();
  writeFileSync(CAPS_DESTINATION, serializeCapsFixture(), 'utf8');
  const byState = caps.casa.heroes.reduce((counts, hero) => {
    counts[hero.state] = (counts[hero.state] ?? 0) + 1;
    return counts;
  }, {});
  console.log(`wrote ${CAPS_DESTINATION}`);
  console.log(
    `  ${Object.entries(byState).map(([state, n]) => `${state} ${String(n)}`).join(', ')}, ` +
      `field_size ${String(caps.casa.field_size)}, rest slots ${String(caps.casa.casa.slots)}, ` +
      `skips ${String(caps.casa.rescues_left)}/${String(caps.casa.rescues_max)}`,
  );
}

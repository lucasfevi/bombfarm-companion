import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

/** The save export's own `generated_at`, as an ISO instant — fixed, so regenerating is a no-op diff. */
const CAPTURED_AT = '2026-08-23T00:00:00.000Z';

/**
 * Walks the `.bfcc` container (5-byte header, then ctxType(1) ctxLength(4 LE) ctx
 * payloadLength(4 LE) payload) and reads each record's frame JSON directly. Parsed here rather
 * than imported because `capture-format.ts` is bundled into the Electron main output rather than
 * emitted per module.
 */
function readCapture() {
  const bytes = readFileSync(CAPTURE);
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
export function buildOfflineFixture() {
  const save = JSON.parse(readFileSync(SAVE_EXPORT, 'utf8'));
  const { order: replayIds, energyById } = readCapture();

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
      field_size: save.skills?.field_slots ?? replayIds.length,
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

/** The exact bytes the committed fixture should hold, newline included. */
export function serializeOfflineFixture() {
  return `${JSON.stringify(buildOfflineFixture(), null, 2)}
`;
}

export const OFFLINE_FIXTURE_PATH = DESTINATION;

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
}

import type { CreditAmounts, LiveDamage, LiveDamageHeroRow, LiveTick, UnattributedReason } from '@bombfarm/contracts';
import {
  createLiveDamageAttributor,
  rosterCombatFacts,
  type FrameCredit,
  type LiveDamageAttributor,
} from '@bombfarm/game-data';
import { BUCKET_SPAN_MS, MAX_TICK_GAP_MS, TEN_MINUTES_MS } from './earnings-fold.js';
import type { LogPort } from './log-port.js';

/**
 * Folds the per-frame credit the attribution engine returns into the damage figures the Live tab
 * shows. The engine owns frame-to-frame continuity (live bombs, fingerprints, signatures); this
 * class owns time: the gap-capped streamed clock, the 10-minute team window and the session
 * ledgers. The clock is the earnings fold's, so both panels agree on what a streamed second is.
 */

/** Live frames arrive about every 200 ms and offline replay about every 100 ms, so a wall gap
 *  past this means frames were lost between two that did arrive. */
export const DISCONTINUITY_WALL_MS = 400;

const MS_PER_SECOND = 1_000;
const RING_CAPACITY = TEN_MINUTES_MS / BUCKET_SPAN_MS + 1;

const REASON_SET = {
  noOwnerAtBirth: true,
  explosionWithoutBomb: true,
  streamDiscontinuity: true,
  unresolvedOverlap: true,
  explosionlessWithoutFantasma: true,
  sharedOrUnattributedKill: true,
  noHitOnLootCell: true,
} satisfies Record<UnattributedReason, true>;

const REASONS = Object.keys(REASON_SET) as UnattributedReason[];

interface Amounts {
  damage: number;
  props: number;
  gold: number;
}

interface HeroLedger extends Amounts {
  fieldMs: number;
}

interface Bucket {
  startedAtMs: number;
  teamDamage: number;
  streamedMs: number;
}

const zeroAmounts = (): Amounts => ({ damage: 0, props: 0, gold: 0 });

const zeroReasons = (): Record<UnattributedReason, Amounts> =>
  Object.fromEntries(REASONS.map((reason) => [reason, zeroAmounts()])) as Record<UnattributedReason, Amounts>;

function add(target: Amounts, amounts: CreditAmounts): void {
  target.damage += amounts.damage;
  target.props += amounts.props;
  target.gold += amounts.gold;
}

function hasAny(amounts: CreditAmounts): boolean {
  return amounts.damage > 0 || amounts.props > 0 || amounts.gold > 0;
}

function compareRows(a: LiveDamageHeroRow, b: LiveDamageHeroRow): number {
  if (a.damage !== b.damage) return b.damage - a.damage;
  return a.heroId < b.heroId ? -1 : a.heroId > b.heroId ? 1 : 0;
}

export interface DamageFoldDeps {
  readonly now: () => number;
  readonly log: LogPort;
  readonly attributor?: LiveDamageAttributor;
}

export type DamageResetTrigger = 'reset' | 'accountChange';

export class DamageFold {
  readonly #deps: DamageFoldDeps;
  readonly #attributor: LiveDamageAttributor;

  #lastSequence = Number.NEGATIVE_INFINITY;
  #lastTickAt: number | null = null;
  #previousFrameFailed = false;

  #streamedMs = 0;
  #team: Amounts = zeroAmounts();
  #heroes = new Map<string, HeroLedger>();
  #unattributed = zeroReasons();
  #present: ReadonlySet<string> = new Set();
  #buckets: Bucket[] = [];

  #frameFailureLogged = false;
  readonly #loggedReasons = new Set<UnattributedReason>();
  readonly #loggedDisagreements = new Set<string>();

  constructor(deps: DamageFoldDeps) {
    this.#deps = deps;
    this.#attributor = deps.attributor ?? createLiveDamageAttributor();
  }

  consumeTick(tick: LiveTick, sequence: number): void {
    if (sequence <= this.#lastSequence) return;
    this.#lastSequence = sequence;

    const now = this.#deps.now();
    const gapMs = this.#lastTickAt === null ? 0 : now - this.#lastTickAt;
    const discontinuous = this.#previousFrameFailed || (this.#lastTickAt !== null && gapMs > DISCONTINUITY_WALL_MS);
    this.#lastTickAt = now;
    const streamedDelta = Math.max(0, Math.min(gapMs, MAX_TICK_GAP_MS));

    const credit = this.#attribute(tick, discontinuous);

    this.#streamedMs += streamedDelta;
    const bucket = this.#bucketFor(now);
    bucket.streamedMs += streamedDelta;

    const presentIds = tick.heroes.map((hero) => hero.id);
    this.#present = new Set(presentIds);
    for (const heroId of presentIds) this.#ledger(heroId).fieldMs += streamedDelta;

    if (credit === null) return;
    add(this.#team, credit.team);
    bucket.teamDamage += credit.team.damage;
    for (const [heroId, amounts] of credit.perHero) add(this.#ledger(heroId), amounts);
    for (const reason of REASONS) {
      const amounts = credit.unattributed[reason];
      add(this.#unattributed[reason], amounts);
      this.#logReasonOnce(reason, amounts);
    }
    for (const disagreement of credit.disagreements) this.#logDisagreementOnce(disagreement);
  }

  setRoster(rawHeroes: readonly unknown[]): void {
    this.#attributor.setRoster(rosterCombatFacts(rawHeroes));
  }

  reset(trigger: DamageResetTrigger): void {
    this.#streamedMs = 0;
    this.#team = zeroAmounts();
    this.#heroes = new Map();
    this.#unattributed = zeroReasons();
    this.#frameFailureLogged = false;
    this.#loggedReasons.clear();
    if (trigger === 'accountChange') {
      this.#buckets = [];
      this.#present = new Set();
      this.#loggedDisagreements.clear();
      this.#attributor.clear();
    }
  }

  get view(): LiveDamage | null {
    if (this.#lastTickAt === null) return null;
    const heroes = this.#rows();
    const unattributedTotal = zeroAmounts();
    for (const reason of REASONS) add(unattributedTotal, this.#unattributed[reason]);
    return {
      teamDps10: this.#windowDps(),
      teamDpsSession: this.#streamedMs === 0 ? null : this.#team.damage / (this.#streamedMs / MS_PER_SECOND),
      coverageSeconds: this.#coverageSeconds(),
      sessionSeconds: this.#streamedMs / MS_PER_SECOND,
      heroes,
      unattributed: this.#team.damage > 0 ? unattributedTotal : null,
      unattributedReasons: structuredClone(this.#unattributed),
      team: { ...this.#team },
    };
  }

  #attribute(tick: LiveTick, discontinuous: boolean): FrameCredit | null {
    try {
      const credit = this.#attributor.consume(tick, { discontinuous });
      this.#previousFrameFailed = false;
      return credit;
    } catch (error) {
      this.#previousFrameFailed = true;
      this.#attributor.forgetLiveBombs();
      if (!this.#frameFailureLogged) {
        this.#frameFailureLogged = true;
        this.#deps.log.warn({ scope: 'live-source', event: 'live_damage.frame_failed', error: String(error) });
      }
      return null;
    }
  }

  #ledger(heroId: string): HeroLedger {
    let ledger = this.#heroes.get(heroId);
    if (ledger === undefined) {
      ledger = { ...zeroAmounts(), fieldMs: 0 };
      this.#heroes.set(heroId, ledger);
    }
    return ledger;
  }

  #rows(): LiveDamageHeroRow[] {
    const rows: LiveDamageHeroRow[] = [];
    for (const [heroId, ledger] of this.#heroes) {
      if (ledger.fieldMs === 0 && !hasAny(ledger)) continue;
      rows.push({
        heroId,
        dps: ledger.fieldMs > 0 ? ledger.damage / (ledger.fieldMs / MS_PER_SECOND) : null,
        damage: ledger.damage,
        props: ledger.props,
        gold: ledger.gold,
        onField: this.#present.has(heroId),
      });
    }
    return rows.sort(compareRows);
  }

  #logReasonOnce(reason: UnattributedReason, amounts: CreditAmounts): void {
    if (this.#loggedReasons.has(reason) || !hasAny(amounts)) return;
    this.#loggedReasons.add(reason);
    this.#deps.log.info({ scope: 'live-source', event: 'live_damage.unattributed_reason', reason });
  }

  #logDisagreementOnce(disagreement: FrameCredit['disagreements'][number]): void {
    if (this.#loggedDisagreements.has(disagreement.heroId)) return;
    this.#loggedDisagreements.add(disagreement.heroId);
    this.#deps.log.info({
      scope: 'live-source',
      event: 'live_damage.fingerprint_disagreement',
      heroId: disagreement.heroId,
      seeded: disagreement.seeded,
      learned: disagreement.learned,
    });
  }

  #bucketFor(now: number): Bucket {
    const startedAtMs = Math.floor(now / BUCKET_SPAN_MS) * BUCKET_SPAN_MS;
    const last = this.#buckets[this.#buckets.length - 1];
    if (last && last.startedAtMs === startedAtMs) return last;

    const bucket: Bucket = { startedAtMs, teamDamage: 0, streamedMs: 0 };
    this.#buckets.push(bucket);
    if (this.#buckets.length > RING_CAPACITY) this.#buckets.shift();
    return bucket;
  }

  #windowBuckets(): readonly Bucket[] {
    const cutoff = this.#deps.now() - TEN_MINUTES_MS;
    for (let oldest = this.#buckets[0]; oldest && oldest.startedAtMs < cutoff; oldest = this.#buckets[0]) {
      this.#buckets.shift();
    }
    return this.#buckets;
  }

  #windowDps(): number | null {
    let damage = 0;
    let streamedMs = 0;
    for (const bucket of this.#windowBuckets()) {
      damage += bucket.teamDamage;
      streamedMs += bucket.streamedMs;
    }
    return streamedMs === 0 ? null : damage / (streamedMs / MS_PER_SECOND);
  }

  #coverageSeconds(): number {
    const oldest = this.#windowBuckets()[0];
    if (!oldest) return 0;
    return (this.#deps.now() - oldest.startedAtMs + BUCKET_SPAN_MS) / MS_PER_SECOND;
  }
}

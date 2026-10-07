import { UNATTRIBUTED_REASONS, type CreditAmounts, type LiveTick, type UnattributedReason } from '@bombfarm/contracts';
import { computeHeroFt } from '../attribution/bomb-ownership.js';
import { createBombLedger } from './bomb-ledger.js';
import { createSignatureBook, creditHits, creditLoot } from './credit.js';
import { createFingerprintBook, type FingerprintDisagreement } from './fingerprints.js';
import { gridRows } from './geometry.js';
import type { RosterCombatFact } from './roster-facts.js';

export interface FrameCredit {
  readonly team: CreditAmounts;
  readonly perHero: ReadonlyMap<string, CreditAmounts>;
  readonly unattributed: Readonly<Record<UnattributedReason, CreditAmounts>>;
  readonly present: readonly string[];
  readonly bombs: {
    readonly births: number;
    readonly adopted: number;
    readonly owned: number;
    readonly cellOwnerConflicts: number;
  };
  readonly hits: { readonly total: number; readonly attributed: number };
  readonly disagreements: readonly FingerprintDisagreement[];
}

export interface ConsumeOptions {
  readonly discontinuous: boolean;
}

export interface LiveDamageAttributor {
  setRoster(facts: readonly RosterCombatFact[]): void;
  consume(tick: LiveTick, options: ConsumeOptions): FrameCredit;
  clear(): void;
  forgetLiveBombs(): void;
}

interface Amounts {
  damage: number;
  props: number;
  gold: number;
}

const zero = (): Amounts => ({ damage: 0, props: 0, gold: 0 });

export function createLiveDamageAttributor(): LiveDamageAttributor {
  const book = createFingerprintBook();
  const ledger = createBombLedger(book);
  const signatures = createSignatureBook();
  let fantasma: ReadonlySet<string> | null = null;

  return {
    setRoster(facts) {
      if (facts.length === 0) {
        fantasma = null;
        return;
      }
      const carriers = new Set<string>();
      for (const fact of facts) {
        if (fact.cooldownReduction !== undefined) book.seed(fact.id, computeHeroFt(fact.cooldownReduction));
        if (fact.carriesFantasma) carriers.add(fact.id);
      }
      fantasma = carriers;
    },

    consume(tick, { discontinuous }) {
      const hits = tick.hits ?? [];
      const step = ledger.advance({ bombs: tick.bombs ?? [], heroes: tick.heroes, discontinuous });
      const hitCredits = creditHits({
        hits,
        explosions: tick.explosions ?? [],
        ledger: step,
        heroes: tick.heroes,
        fantasma,
        rows: gridRows(tick.kinds),
        signatures,
      });
      const lootCredits = creditLoot(tick.loot ?? [], hitCredits);

      const team = zero();
      const perHero = new Map<string, Amounts>();
      const unattributed = Object.fromEntries(UNATTRIBUTED_REASONS.map((reason) => [reason, zero()])) as Record<
        UnattributedReason,
        Amounts
      >;
      const heroAmounts = (heroId: string): Amounts => {
        let amounts = perHero.get(heroId);
        if (amounts === undefined) {
          amounts = zero();
          perHero.set(heroId, amounts);
        }
        return amounts;
      };

      let attributedHits = 0;
      for (const credit of hitCredits) {
        team.damage += credit.damage;
        if (credit.credited === null) {
          unattributed[credit.reason].damage += credit.damage;
        } else {
          attributedHits += 1;
          heroAmounts(credit.credited).damage += credit.damage;
        }
      }
      for (const credit of lootCredits) {
        team.props += 1;
        team.gold += credit.gold;
        const target = credit.credited === null ? unattributed[credit.reason] : heroAmounts(credit.credited);
        target.props += 1;
        target.gold += credit.gold;
      }

      return {
        team,
        perHero,
        unattributed,
        present: tick.heroes.map((hero) => hero.id),
        bombs: {
          births: step.births,
          adopted: step.adopted,
          owned: step.owned,
          cellOwnerConflicts: step.cellOwnerConflicts,
        },
        hits: { total: hitCredits.length, attributed: attributedHits },
        disagreements: step.disagreements,
      };
    },

    clear() {
      ledger.clear();
      book.clear();
      signatures.clear();
      fantasma = null;
    },

    forgetLiveBombs() {
      ledger.clear();
    },
  };
}

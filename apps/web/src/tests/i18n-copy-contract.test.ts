/**
 * The two-tier copy contract, enforced over the strings themselves
 * (data), not a rendered component. Tier 1 (the automatic gate — `resetAdviceGain*`) may only
 * claim a LOWER BOUND and must name Optimize build as the
 * definitive answer. Tier 2 (`optimizeBuild*` / `previewApply*`, on demand) may claim the best
 * allocation ITS OWN search found, but never optimality, and never frames a result larger than
 * Tier 1's estimate as a correction or an inconsistency — tier monotonicity already guarantees
 * `optimizeBuild.reoptDps >= findGateCandidate.reoptDps` structurally, so a larger Tier 2
 * number is expected behaviour.
 */
import { describe, expect, it } from 'vitest';
import { STRINGS, type Lang } from '@/shared/i18n';

const LANGS: Lang[] = ['en', 'pt'];

/** Case-insensitive "does this string contain a definite-gain / future-tense promise" probe. */
const DEFINITE_GAIN_PATTERNS: Record<Lang, RegExp[]> = {
  en: [/\bwill gain\b/i, /\byou('| wi)ll get\b/i, /\bguaranteed\b/i],
  pt: [/\bvai ganhar\b/i, /\bvocê ganhará\b/i, /\bgarantid[oa]\b/i],
};

/**
 * Bare percentage gain forms that must never appear in Tier 1 — including the badge.
 * M2: rewriting the badge to `"+{pct}% DPS"` must fail this contract without relying on
 * fixture parity alone (Verifier discrimination sensor).
 */
const BARE_PERCENTAGE_GAIN: Record<Lang, RegExp[]> = {
  en: [
    /^\+?\{pct\}%\b/,
    /\+\s*\{pct\}%\s*(DPS|more|gain)/i,
    /\bavailable\b.*\{pct\}%/i,
    /\{pct\}%\s*(DPS|available|more)/i,
  ],
  pt: [
    /^\+?\{pct\}%\b/,
    /\+\s*\{pct\}%\s*(DPS|a mais|ganho)/i,
    /\{pct\}%\s*(DPS|disponível|a mais)/i,
  ],
};

/** The lower-bound hedge Tier 1 must carry *when* a percentage slot is present. */
const LOWER_BOUND_MARKER: Record<Lang, RegExp> = {
  en: /at least ~?\{pct\}%/i,
  pt: /pelo menos ~?\{pct\}%/i,
};

/** "optimal" claims Tier 2 must never make. */
const OPTIMALITY_PATTERNS: Record<Lang, RegExp[]> = {
  en: [/\boptimal\b/i, /\bbest possible\b/i, /\bperfect\b/i],
  pt: [/\bótim[oa]\b/i, /\bperfeit[oa]\b/i, /\bmelhor possível\b/i],
};

/** "correction" / "inconsistency" framing Tier 2 must never use for a larger-than-badge result. */
const CORRECTION_PATTERNS: Record<Lang, RegExp[]> = {
  en: [/\bcorrect(ed|ion|s)?\b/i, /\binconsisten(t|cy)\b/i, /\berror\b/i, /\bfix(ed|es)?\b/i],
  pt: [/\bcorreç(ão|ões)\b/i, /\bcorrig(e|ir|ido)\b/i, /\binconsistent[ea]?\b/i, /\berro\b/i],
};

const TIER1_KEYS = ['resetAdviceGainLine'] as const;
const TIER2_KEYS = [
  'optimizeBuildButton',
  'optimizeBuildResultLine',
  'optimizeBuildKeptCurrent',
  'optimizeBuildBudgetExhausted',
  'optimizeBuildNoBudgetReason',
  'optimizeBuildFarmResultLine',
  'optimizeBuildFarmKeptCurrent',
  'optimizeBuildFarmNoPool',
  'optimizeBuildFarmNoRate',
  'previewApplyButton',
  'previewClearButton',
  'previewRespecNote',
] as const;

describe('i18n copy contract — Tier 1 (reset advice gate) never over-claims', () => {
  for (const lang of LANGS) {
    const t = STRINGS[lang];

    it(`${lang}: no definite-gain / future-tense promise in any Tier 1 string`, () => {
      for (const key of TIER1_KEYS) {
        const text = t[key];
        for (const pattern of DEFINITE_GAIN_PATTERNS[lang]) {
          expect(text, `${key} ("${text}") matched ${pattern}`).not.toMatch(pattern);
        }
      }
    });

    it(`${lang}: no bare percentage gain form in any Tier 1 string (blocks "+{pct}% DPS")`, () => {
      for (const key of TIER1_KEYS) {
        const text = t[key];
        for (const pattern of BARE_PERCENTAGE_GAIN[lang]) {
          expect(text, `${key} ("${text}") matched ${pattern}`).not.toMatch(pattern);
        }
      }
    });

    it(`${lang}: every Tier 1 string names Optimize build — embeds the button's own label`, () => {
      for (const key of TIER1_KEYS) {
        expect(t[key], `${key} must name Optimize build`).toContain(t.optimizeBuildButton);
      }
    });

    it(`${lang}: resetAdviceGainLine carries the lower-bound marker ("at least ~X%" / "pelo menos ~X%")`, () => {
      expect(t.resetAdviceGainLine).toMatch(LOWER_BOUND_MARKER[lang]);
    });

    it(`${lang}: resetAdviceGainLine's percentage never appears bare — always preceded by the hedge`, () => {
      // The only numeric slot is the `{pct}` placeholder itself; assert it is not reachable
      // without the "at least ~" / "pelo menos ~" prefix immediately before it.
      const barePctIndex = t.resetAdviceGainLine.indexOf('{pct}%');
      expect(barePctIndex).toBeGreaterThan(0);
      const prefix = t.resetAdviceGainLine.slice(0, barePctIndex);
      const hedge = lang === 'en' ? /at least ~?$/i : /pelo menos ~?$/i;
      expect(prefix).toMatch(hedge);
    });
  }
});

describe('i18n copy contract — Tier 2 (Optimize build) claims "best found", never "optimal"', () => {
  for (const lang of LANGS) {
    const t = STRINGS[lang];

    it(`${lang}: no optimality claim in any Tier 2 string`, () => {
      for (const key of TIER2_KEYS) {
        const text = t[key];
        for (const pattern of OPTIMALITY_PATTERNS[lang]) {
          expect(text, `${key} ("${text}") matched ${pattern}`).not.toMatch(pattern);
        }
      }
    });

    it(`${lang}: a larger Tier 2 result is never framed as a correction or an inconsistency`, () => {
      for (const key of TIER2_KEYS) {
        const text = t[key];
        for (const pattern of CORRECTION_PATTERNS[lang]) {
          expect(text, `${key} ("${text}") matched ${pattern}`).not.toMatch(pattern);
        }
      }
    });

    it(`${lang}: optimizeBuildResultLine may present its percentage as the best allocation found`, () => {
      expect(t.optimizeBuildResultLine).toContain('{pct}%');
    });
  }
});

/**
 * Optimize build searches for one of two things and they are denominated differently — one
 * hero's sustained DPS, or the whole rotation's gold per hour. A result line that named the
 * other target's unit would be a wrong number rather than a clumsy sentence, so each line has
 * to name its own unit and must not name the other's. The Tier 1 gate is DPS-only and is held
 * to the same rule: it now says so, because an unqualified "possible gain" no longer says which
 * of the two targets it measured.
 */
describe('i18n copy contract — the two Optimize build targets never borrow each other unit', () => {
  const DPS_UNIT: Record<Lang, RegExp> = { en: /sustained[- ]DPS/i, pt: /DPS efetivo/i };
  const FARM_UNIT: Record<Lang, RegExp> = { en: /gold per hour/i, pt: /ouro por hora/i };

  for (const lang of LANGS) {
    const t = STRINGS[lang];

    it(`${lang}: the DPS result line names sustained DPS and never gold per hour`, () => {
      expect(t.optimizeBuildResultLine).toMatch(DPS_UNIT[lang]);
      expect(t.optimizeBuildResultLine).not.toMatch(FARM_UNIT[lang]);
    });

    it(`${lang}: the farm result line names gold per hour and never sustained DPS`, () => {
      expect(t.optimizeBuildFarmResultLine).toMatch(FARM_UNIT[lang]);
      expect(t.optimizeBuildFarmResultLine).not.toMatch(DPS_UNIT[lang]);
    });

    it(`${lang}: the Tier 1 gate line says the gain it found is a sustained-DPS one`, () => {
      expect(t.resetAdviceGainLine).toMatch(DPS_UNIT[lang]);
      expect(t.tabPointsResetAdvice).toMatch(DPS_UNIT[lang]);
    });

    it(`${lang}: the two kept-current lines are distinct — neither target speaks for the other`, () => {
      expect(t.optimizeBuildFarmKeptCurrent).not.toBe(t.optimizeBuildKeptCurrent);
    });
  }
});

describe('i18n copy contract — key naming keeps the two tiers apart', () => {
  it('Tier 1 keys are all resetAdviceGain*', () => {
    for (const key of TIER1_KEYS) {
      expect(key).toMatch(/^resetAdviceGain/);
    }
  });

  it('Tier 2 keys are all optimizeBuild* / previewApply* / previewClear* / previewRespec*', () => {
    for (const key of TIER2_KEYS) {
      expect(key).toMatch(/^(optimizeBuild|preview)/);
    }
  });
});

describe('i18n copy contract — Luck row states it is loot-facing, not scored for DPS', () => {
  for (const lang of LANGS) {
    const t = STRINGS[lang];

    it(`${lang}: pointsLuckHint names both Next point and Optimize build as excluding it`, () => {
      const nextPointName = lang === 'en' ? /next point/i : /próximo ponto/i;
      const optimizeBuildName = t.optimizeBuildButton;
      expect(t.pointsLuckHint).toMatch(nextPointName);
      expect(t.pointsLuckHint).toContain(optimizeBuildName);
    });
  }
});

/**
 * Farm Respec Advisor T7 — the same lower-bound-vs-precise shape as the reset-advice contract
 * above, applied to the toolbar headline (Tier 1, a conservative gate estimate) vs. the panel
 * (Tier 2, the fuller on-demand solve). Tier 2 legitimately reports a HIGHER number than Tier 1
 * — that is the two-tier design working, not an inconsistency — so the two keys must carry
 * distinct wording: the headline hedges, the panel does not.
 */
const FARM_RESPEC_LOWER_BOUND_MARKER: Record<Lang, RegExp> = {
  en: /at least ~?\{pct\}%/i,
  pt: /pelo menos ~?\{pct\}%/i,
};

describe('i18n copy contract — Farm Respec Advisor headline is a lower bound, the panel is not', () => {
  for (const lang of LANGS) {
    const t = STRINGS[lang];

    it(`${lang}: farmRespecHeadlineGain (Tier 1) carries the lower-bound hedge`, () => {
      expect(t.farmRespecHeadlineGain).toMatch(FARM_RESPEC_LOWER_BOUND_MARKER[lang]);
    });

    it(`${lang}: farmRespecPanelGain (Tier 2) does NOT carry the lower-bound hedge — a larger number here is the copy working, not a correction`, () => {
      expect(t.farmRespecPanelGain).not.toMatch(FARM_RESPEC_LOWER_BOUND_MARKER[lang]);
      for (const pattern of CORRECTION_PATTERNS[lang]) {
        expect(t.farmRespecPanelGain).not.toMatch(pattern);
      }
    });
  }
});

/**
 * No move-level annotation anywhere in the Farm Respec Advisor's own strings reads as "this one
 * doesn't matter" — every changed key is shown with its raw delta, never tagged skippable. A
 * later guard extends this same scan to the component files; this half covers the copy data.
 */
const NEGLIGIBLE_ANNOTATION_PATTERNS: Record<Lang, RegExp[]> = {
  en: [/\boptional\b/i, /\bnegligible\b/i, /\bminor\b/i, /\bskip(pable)?\b/i],
  pt: [/\bopcional\b/i, /\bnegligenci[aá]vel\b/i, /\bmenor\b/i, /\bpul(ar|ável)\b/i],
};

describe('i18n copy contract — no Farm Respec Advisor string tags a move optional/negligible/minor/skippable', () => {
  for (const lang of LANGS) {
    const t = STRINGS[lang] as unknown as Record<string, string>;

    it(`${lang}: no farmRespec* value matches the negligible-annotation vocabulary`, () => {
      const offenders: string[] = [];
      for (const key of Object.keys(t)) {
        if (!key.startsWith('farmRespec')) continue;
        const text = t[key];
        for (const pattern of NEGLIGIBLE_ANNOTATION_PATTERNS[lang]) {
          if (pattern.test(text)) offenders.push(`${key} matched ${pattern}`);
        }
      }
      expect(offenders).toEqual([]);
    });
  }
});

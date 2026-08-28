import { describe, expect, it } from 'vitest';
import type { AccountFidelity, AccountSection, SectionFidelity } from '@bombfarm/contracts';
import { ACCOUNT_SECTIONS, deriveAccountFidelity } from '@bombfarm/domain/account-fidelity';

const CAPTURED_AT = '2026-08-12T00:00:00.000Z';
const RESOLVED: SectionFidelity = { status: 'resolved', capturedAt: CAPTURED_AT };
const STALE: SectionFidelity = { status: 'stale', capturedAt: CAPTURED_AT };
const MISSING: SectionFidelity = { status: 'missing' };

function allResolved(): AccountFidelity {
  return {
    account: RESOLVED,
    heroes: RESOLVED,
    skills: RESOLVED,
    casa: RESOLVED,
    items: RESOLVED,
  };
}

function withOverride(section: AccountSection, status: SectionFidelity): AccountFidelity {
  return { ...allResolved(), [section]: status };
}

function allWith(status: SectionFidelity): AccountFidelity {
  return {
    account: status,
    heroes: status,
    skills: status,
    casa: status,
    items: status,
  };
}

describe('ACCOUNT_SECTIONS', () => {
  it('is exactly the five spec sections, in canonical order', () => {
    expect(ACCOUNT_SECTIONS).toEqual(['account', 'heroes', 'skills', 'casa', 'items']);
  });
});

describe('deriveAccountFidelity', () => {
  it('grades full with no degraded sections when fidelity is absent', () => {
    expect(deriveAccountFidelity(undefined)).toEqual({ grade: 'full', degradedSections: [] });
  });

  it('grades full with no degraded sections when every section is resolved', () => {
    expect(deriveAccountFidelity(allResolved())).toEqual({ grade: 'full', degradedSections: [] });
  });

  for (const section of ACCOUNT_SECTIONS) {
    it(`grades degraded naming only "${section}" when it alone is stale`, () => {
      expect(deriveAccountFidelity(withOverride(section, STALE))).toEqual({
        grade: 'degraded',
        degradedSections: [section],
      });
    });

    it(`grades degraded naming only "${section}" when it alone is missing`, () => {
      expect(deriveAccountFidelity(withOverride(section, MISSING))).toEqual({
        grade: 'degraded',
        degradedSections: [section],
      });
    });
  }

  it('grades degraded naming both sections, in ACCOUNT_SECTIONS order, for a mixed stale+missing case', () => {
    const fidelity: AccountFidelity = {
      ...allResolved(),
      heroes: STALE,
      items: MISSING,
    };
    expect(deriveAccountFidelity(fidelity)).toEqual({
      grade: 'degraded',
      degradedSections: ['heroes', 'items'],
    });
  });

  it('grades unavailable naming all five sections when none is resolved (all missing)', () => {
    expect(deriveAccountFidelity(allWith(MISSING))).toEqual({
      grade: 'unavailable',
      degradedSections: ['account', 'heroes', 'skills', 'casa', 'items'],
    });
  });

  it('grades unavailable naming all five sections when none is resolved (all stale)', () => {
    expect(deriveAccountFidelity(allWith(STALE))).toEqual({
      grade: 'unavailable',
      degradedSections: ['account', 'heroes', 'skills', 'casa', 'items'],
    });
  });

  it('grades degraded when four sections are stale and one is resolved', () => {
    const fidelity: AccountFidelity = {
      account: STALE,
      heroes: STALE,
      skills: STALE,
      casa: STALE,
      items: RESOLVED,
    };
    expect(deriveAccountFidelity(fidelity)).toEqual({
      grade: 'degraded',
      degradedSections: ['account', 'heroes', 'skills', 'casa'],
    });
  });
});

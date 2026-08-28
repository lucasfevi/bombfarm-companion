import type { AccountSection } from '@bombfarm/contracts';
import { describe, expect, it } from 'vitest';
import { assembleAccountPayload } from './assemble.js';
import type { SectionOutcome } from './routes.js';

const NOW = '2026-08-12T13:15:38.000Z';

const OK_ACCOUNT: SectionOutcome = { kind: 'ok', body: { gold: 100 } };
const OK_HEROES: SectionOutcome = { kind: 'ok', body: [{ id: '1' }] };
const OK_SKILLS: SectionOutcome = { kind: 'ok', body: { totals: {} } };
const OK_CASA: SectionOutcome = { kind: 'ok', body: { active_casa: 1 } };
const OK_ITEMS: SectionOutcome = { kind: 'ok', body: [{ id: '99' }] };

const ALL_OK: Record<AccountSection, SectionOutcome> = {
  account: OK_ACCOUNT,
  heroes: OK_HEROES,
  skills: OK_SKILLS,
  casa: OK_CASA,
  items: OK_ITEMS,
};

const FAILED: SectionOutcome = { kind: 'failed', reason: 'transport_error' };
const DRIFT_MISSING_TOTALS: SectionOutcome = {
  kind: 'drift',
  body: { totals: 'still-usable' },
  missingKeys: ['totals'],
  addedKeys: [],
};
// T6: a drift outcome whose ONLY finding is an added key — proves addedKeys threads
// through assembleAccountPayload independently of missingKeys, not merely alongside it.
const DRIFT_ADDED_REFUNDS: SectionOutcome = {
  kind: 'drift',
  body: { totals: {}, refunds: {} },
  missingKeys: [],
  addedKeys: ['refunds'],
};

describe('assembleAccountPayload — arity and no history/grade (R-1 closed by signature)', () => {
  it('has arity 2 — no history parameter', () => {
    expect(assembleAccountPayload.length).toBe(2);
  });

  it('is pure — no Date.now(), same inputs produce the same output object shape', () => {
    const first = assembleAccountPayload(ALL_OK, NOW);
    const second = assembleAccountPayload(ALL_OK, NOW);
    expect(first).toEqual(second);
  });

  it('produces no grade key at all', () => {
    const payload = assembleAccountPayload(ALL_OK, NOW);
    expect('grade' in payload).toBe(false);
  });

  it('does not mutate the outcomes argument it was given', () => {
    const outcomes: Record<AccountSection, SectionOutcome> = { ...ALL_OK };
    const snapshotBefore = JSON.stringify(outcomes);
    assembleAccountPayload(outcomes, NOW);
    expect(JSON.stringify(outcomes)).toBe(snapshotBefore);
  });

  it('always returns a fidelity block naming exactly the five AccountSection keys, whatever the outcome mix', () => {
    const outcomes: Record<AccountSection, SectionOutcome> = { ...ALL_OK, heroes: FAILED, skills: DRIFT_MISSING_TOTALS };
    const payload = assembleAccountPayload(outcomes, NOW);
    expect(Object.keys(payload.fidelity ?? {}).sort()).toEqual(['account', 'casa', 'heroes', 'items', 'skills']);
  });
});

describe('assembleAccountPayload — per-outcome mapping', () => {
  it('ok -> body present, fidelity resolved with the injected capturedAt', () => {
    const payload = assembleAccountPayload(ALL_OK, NOW);
    expect(payload.account).toEqual({ gold: 100 });
    expect(payload.fidelity?.account).toEqual({ status: 'resolved', capturedAt: NOW });
  });

  it('drift -> body present (the projection readSection already accepted), fidelity degraded with capturedAt, missingKeys and addedKeys', () => {
    const outcomes: Record<AccountSection, SectionOutcome> = { ...ALL_OK, account: DRIFT_MISSING_TOTALS };
    const payload = assembleAccountPayload(outcomes, NOW);

    expect('account' in payload).toBe(true);
    expect(payload.account).toEqual({ totals: 'still-usable' });
    expect(payload.fidelity?.account).toEqual({
      status: 'degraded',
      capturedAt: NOW,
      missingKeys: ['totals'],
      addedKeys: [],
    });
  });

  it('drift -> addedKeys passes through UNCHANGED, independently of missingKeys', () => {
    const outcomes: Record<AccountSection, SectionOutcome> = { ...ALL_OK, skills: DRIFT_ADDED_REFUNDS };
    const payload = assembleAccountPayload(outcomes, NOW);

    expect('skills' in payload).toBe(true);
    expect(payload.skills).toEqual({ totals: {}, refunds: {} });
    expect(payload.fidelity?.skills).toEqual({
      status: 'degraded',
      capturedAt: NOW,
      missingKeys: [],
      addedKeys: ['refunds'],
    });
  });

  it('failed -> no body, fidelity missing with no capturedAt', () => {
    const outcomes: Record<AccountSection, SectionOutcome> = { ...ALL_OK, account: FAILED };
    const payload = assembleAccountPayload(outcomes, NOW);

    expect('account' in payload).toBe(false);
    expect(payload.fidelity?.account).toEqual({ status: 'missing' });
    expect(payload.fidelity?.account.capturedAt).toBeUndefined();
  });

  it('a section that was never read (failed) stays distinguishable from one that was read and drifted (degraded) — different status, key presence and body', () => {
    const outcomes: Record<AccountSection, SectionOutcome> = { ...ALL_OK, account: FAILED, casa: DRIFT_MISSING_TOTALS };
    const payload = assembleAccountPayload(outcomes, NOW);

    expect(payload.fidelity?.account.status).toBe('missing');
    expect(payload.fidelity?.casa.status).toBe('degraded');
    expect('account' in payload).toBe(false);
    expect('casa' in payload).toBe(true);
  });
});

describe('assembleAccountPayload — the skills-never-fabricated rule (D24)', () => {
  it("emits no 'skills' key at all when the skills outcome is failed — key absent, not undefined", () => {
    const outcomes: Record<AccountSection, SectionOutcome> = { ...ALL_OK, skills: FAILED };
    const payload = assembleAccountPayload(outcomes, NOW);
    expect('skills' in payload).toBe(false);
    expect(payload.skills).toBeUndefined();
  });

  it("emits the 'skills' key when the skills outcome is drift — a drift outcome only ever carries a body readSection already judged usable, never a fabricated one", () => {
    const outcomes: Record<AccountSection, SectionOutcome> = { ...ALL_OK, skills: DRIFT_MISSING_TOTALS };
    const payload = assembleAccountPayload(outcomes, NOW);
    expect('skills' in payload).toBe(true);
    expect(payload.skills).toEqual({ totals: 'still-usable' });
  });
});

describe('assembleAccountPayload — the outcome matrix', () => {
  it('all five ok -> every section present with a body', () => {
    const payload = assembleAccountPayload(ALL_OK, NOW);
    for (const section of ['account', 'heroes', 'skills', 'casa', 'items'] as const) {
      expect(section in payload).toBe(true);
      expect(payload.fidelity?.[section].status).toBe('resolved');
    }
  });

  const sections: AccountSection[] = ['account', 'heroes', 'skills', 'casa', 'items'];

  for (const failingSection of sections) {
    it(`only ${failingSection} failed -> every other section still delivered with its body`, () => {
      const outcomes: Record<AccountSection, SectionOutcome> = { ...ALL_OK, [failingSection]: FAILED };
      const payload = assembleAccountPayload(outcomes, NOW);

      for (const section of sections) {
        if (section === failingSection) {
          expect(section in payload).toBe(false);
          expect(payload.fidelity?.[section].status).toBe('missing');
        } else {
          expect(section in payload).toBe(true);
          expect(payload.fidelity?.[section].status).toBe('resolved');
        }
      }
    });
  }

  for (const driftingSection of sections) {
    it(`only ${driftingSection} drifted -> every section, including the drifted one, still delivered with a body`, () => {
      const outcomes: Record<AccountSection, SectionOutcome> = { ...ALL_OK, [driftingSection]: DRIFT_MISSING_TOTALS };
      const payload = assembleAccountPayload(outcomes, NOW);

      for (const section of sections) {
        expect(section in payload).toBe(true);
        if (section === driftingSection) {
          expect(payload.fidelity?.[section].status).toBe('degraded');
          expect((payload as unknown as Record<AccountSection, unknown>)[section]).toEqual({
            totals: 'still-usable',
          });
        } else {
          expect(payload.fidelity?.[section].status).toBe('resolved');
        }
      }
    });
  }

  it('all five failed (declined/offline) -> no section bodies at all, every fidelity missing', () => {
    const outcomes: Record<AccountSection, SectionOutcome> = {
      account: FAILED,
      heroes: FAILED,
      skills: FAILED,
      casa: FAILED,
      items: FAILED,
    };
    const payload = assembleAccountPayload(outcomes, NOW);

    for (const section of sections) {
      expect(section in payload).toBe(false);
      expect(payload.fidelity?.[section]).toEqual({ status: 'missing' });
    }
  });
});

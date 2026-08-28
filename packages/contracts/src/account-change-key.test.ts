/**
 * The probe table IS the test (design.md §2.4, tasks.md T1). Every row is one `it`; the red
 * state each row exists to catch is demonstrated at the bottom rather than merely claimed.
 */
import { describe, expect, it } from 'vitest';
import type { AccountFidelity, AccountPayload } from './account-payload.js';
import { accountChangeKey } from './account-change-key.js';

const CAPTURED_AT_A = '2026-08-12T00:00:00.000Z';
const CAPTURED_AT_B = '2026-08-13T00:00:00.000Z';

function required<T>(value: T | undefined, message: string): T {
  if (value === undefined) throw new Error(message);
  return value;
}

function resolvedFidelity(capturedAt: string): AccountFidelity {
  return {
    account: { status: 'resolved', capturedAt },
    heroes: { status: 'resolved', capturedAt },
    skills: { status: 'resolved', capturedAt },
    casa: { status: 'resolved', capturedAt },
    items: { status: 'resolved', capturedAt },
  };
}

function basePayload(capturedAt: string): AccountPayload {
  return {
    account: { phase: 30 },
    heroes: [{ id: 'h1', name: 'Alpha', level: 20 }],
    skills: { totals: { dmg_static: 2.1 } },
    casa: { active_casa: 1, levels: [10] },
    items: [{ id: 'i1', def_id: 'd1' }],
    fidelity: resolvedFidelity(capturedAt),
  };
}

describe('accountChangeKey — the probe table (design.md §2.4)', () => {
  it('capturedAt changed on all five sections, bodies identical ⇒ same key', () => {
    const a = accountChangeKey(basePayload(CAPTURED_AT_A));
    const b = accountChangeKey(basePayload(CAPTURED_AT_B));
    expect(a).toBe(b);
  });

  it('skills.status resolved → stale, body byte-identical ⇒ different key (MAR-09)', () => {
    const resolved = basePayload(CAPTURED_AT_A);
    const stale: AccountPayload = {
      ...resolved,
      fidelity: { ...required(resolved.fidelity, 'expected fidelity'), skills: { status: 'stale', capturedAt: CAPTURED_AT_A } },
    };
    expect(accountChangeKey(resolved)).not.toBe(accountChangeKey(stale));
  });

  it('skills.status → degraded with missingKeys ⇒ different key, and a different missingKeys list ⇒ different again', () => {
    const resolved = basePayload(CAPTURED_AT_A);
    const { skills: _resolvedSkills, ...restPayload } = resolved;
    const degradedA: AccountPayload = {
      ...restPayload,
      fidelity: {
        ...required(resolved.fidelity, 'expected fidelity'),
        skills: { status: 'degraded', capturedAt: CAPTURED_AT_A, missingKeys: ['totals.dmg_static'], addedKeys: [] },
      },
    };
    const degradedB: AccountPayload = {
      ...restPayload,
      fidelity: {
        ...required(resolved.fidelity, 'expected fidelity'),
        skills: {
          status: 'degraded',
          capturedAt: CAPTURED_AT_A,
          missingKeys: ['totals.dmg_static', 'totals.crit_dmg_mult'],
          addedKeys: [],
        },
      },
    };
    const keyResolved = accountChangeKey(resolved);
    const keyDegradedA = accountChangeKey(degradedA);
    const keyDegradedB = accountChangeKey(degradedB);
    expect(keyDegradedA).not.toBe(keyResolved);
    expect(keyDegradedB).not.toBe(keyDegradedA);
  });

  it('two payloads differing ONLY in addedKeys produce different keys (two-tier change detection — must never false-negative)', () => {
    const resolved = basePayload(CAPTURED_AT_A);
    const { skills: _resolvedSkills, ...restPayload } = resolved;
    const degradedNoAdded: AccountPayload = {
      ...restPayload,
      fidelity: {
        ...required(resolved.fidelity, 'expected fidelity'),
        skills: { status: 'degraded', capturedAt: CAPTURED_AT_A, missingKeys: [], addedKeys: [] },
      },
    };
    const degradedWithAdded: AccountPayload = {
      ...restPayload,
      fidelity: {
        ...required(resolved.fidelity, 'expected fidelity'),
        skills: {
          status: 'degraded',
          capturedAt: CAPTURED_AT_A,
          missingKeys: [],
          addedKeys: ['skills.totals.something_new'],
        },
      },
    };
    expect(accountChangeKey(degradedNoAdded)).not.toBe(accountChangeKey(degradedWithAdded));
  });

  it("one hero's level incremented ⇒ different key", () => {
    const before = basePayload(CAPTURED_AT_A);
    const after: AccountPayload = {
      ...before,
      heroes: [{ id: 'h1', name: 'Alpha', level: 21 }],
    };
    expect(accountChangeKey(before)).not.toBe(accountChangeKey(after));
  });

  it('a section absent vs the same section present-and-empty ⇒ different keys', () => {
    const present = basePayload(CAPTURED_AT_A);
    const { items: _items, ...withoutItems } = present;
    const absent: AccountPayload = { ...withoutItems, fidelity: present.fidelity };
    const presentEmpty: AccountPayload = { ...present, items: [] };
    expect(accountChangeKey(absent)).not.toBe(accountChangeKey(presentEmpty));
  });

  it('two AccountViews differing only in gameRunning ⇒ same key — gameRunning is not a payload field at all', () => {
    // accountChangeKey's signature only accepts a payload, so this is asserted at the type/call
    // level: the same payload keyed twice produces the same key regardless of what a caller's
    // gameRunning flag says elsewhere on the AccountView. This is the proof that MAR-05
    // ("holds unchanged whether or not the game is running") rests on: the field is structurally
    // incapable of entering the key, not merely absent from today's call sites.
    const payload = basePayload(CAPTURED_AT_A);
    const viewA = { payload, gameRunning: true };
    const viewB = { payload, gameRunning: false };
    expect(accountChangeKey(viewA.payload)).toBe(accountChangeKey(viewB.payload));
  });

  it('key-order immunity: re-ordering an object\'s keys leaves the key unchanged, and a naive JSON.stringify would have differed', () => {
    const ordered = basePayload(CAPTURED_AT_A);
    // Same values, deliberately re-ordered top-level payload keys AND a re-ordered nested object
    // (skills.totals) — canonical stringify must survive both.
    const reordered: AccountPayload = {
      fidelity: ordered.fidelity,
      items: ordered.items,
      casa: ordered.casa,
      skills: { totals: { dmg_static: 2.1 } },
      heroes: ordered.heroes,
      account: ordered.account,
    };

    expect(accountChangeKey(ordered)).toBe(accountChangeKey(reordered));

    // The insertion-order variant WOULD have differed — this is why canonical is worth its cost
    // (design.md's two-tier change detection), not just an assertion that the real function happens to agree.
    expect(JSON.stringify(ordered)).not.toBe(JSON.stringify(reordered));
  });

  it('demonstrates the red state: a key that reads capturedAt fails the first probe (restored immediately after)', () => {
    function keyThatLeaksCapturedAt(payload: AccountPayload): string {
      // A deliberately wrong variant — capturedAt included — to prove the real probe above would
      // catch this mistake if it were ever (re)introduced.
      return JSON.stringify(payload);
    }
    const a = keyThatLeaksCapturedAt(basePayload(CAPTURED_AT_A));
    const b = keyThatLeaksCapturedAt(basePayload(CAPTURED_AT_B));
    expect(a).not.toBe(b); // the mistake WOULD have failed the "capturedAt changed ⇒ same key" probe
    // The real function does not make this mistake:
    expect(accountChangeKey(basePayload(CAPTURED_AT_A))).toBe(accountChangeKey(basePayload(CAPTURED_AT_B)));
  });
});

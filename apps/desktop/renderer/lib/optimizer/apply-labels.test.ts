import { describe, expect, it } from 'vitest';
import { en } from '../copy/en';
import { sub } from '../copy';
import {
  APPLY_ROW_SKIP_REASON_COPY_KEY,
  APPLY_SKIP_REASON_COPY_KEY,
  APPLY_STOP_REASON_COPY_KEY,
  applyStartRefusalText,
  formatClock,
  unitCardText,
  type ApplyUnitLabel,
} from './apply-labels';

describe('APPLY_SKIP_REASON_COPY_KEY', () => {
  it('every member renders its key English, including the two core-only reasons', () => {
    for (const [reason, key] of Object.entries(APPLY_SKIP_REASON_COPY_KEY)) {
      expect(en[key], reason).toEqual(expect.any(String));
      expect(en[key].length).toBeGreaterThan(0);
    }
    expect(en[APPLY_SKIP_REASON_COPY_KEY.alreadyDone]).toBe('already done when the step reached it');
  });
});

describe('APPLY_ROW_SKIP_REASON_COPY_KEY', () => {
  it('every member renders its key English, including the row-only forgeAtTarget reason', () => {
    for (const [reason, key] of Object.entries(APPLY_ROW_SKIP_REASON_COPY_KEY)) {
      expect(en[key], reason).toEqual(expect.any(String));
      expect(en[key].length).toBeGreaterThan(0);
    }
    expect(en[APPLY_ROW_SKIP_REASON_COPY_KEY.forgeAtTarget]).toBe('already at its target');
  });
});

describe('APPLY_STOP_REASON_COPY_KEY', () => {
  it('every member but refused renders its key English', () => {
    for (const [stop, key] of Object.entries(APPLY_STOP_REASON_COPY_KEY)) {
      if (stop === 'refused') continue;
      expect(en[key], stop).toEqual(expect.any(String));
      expect(en[key].length).toBeGreaterThan(0);
    }
  });

  it("refused's key carries a {code} placeholder, and sub() interpolates it", () => {
    expect(en[APPLY_STOP_REASON_COPY_KEY.refused]).toContain('{code}');
    expect(sub(en[APPLY_STOP_REASON_COPY_KEY.refused], { code: 'E_BAD' })).toBe('the server refused: E_BAD');
  });
});

describe('applyStartRefusalText', () => {
  it('busy, not_consented, game_not_running, token_unavailable and unavailable reuse the Forge tab wording verbatim', () => {
    expect(applyStartRefusalText('busy', en)).toBe(en.forgeStartBusy);
    expect(applyStartRefusalText('not_consented', en)).toBe(en.forgeStartNotConsented);
    expect(applyStartRefusalText('game_not_running', en)).toBe(en.forgeStartGameNotRunning);
    expect(applyStartRefusalText('token_unavailable', en)).toBe(en.forgeStartTokenUnavailable);
    expect(applyStartRefusalText('unavailable', en)).toBe(en.forgeStartUnavailable);
  });

  it('writes_disabled interpolates the current switch label', () => {
    expect(applyStartRefusalText('writes_disabled', en)).toContain(en.settingsForgeWritesLabel);
  });

  it('offline reads "No server to apply on", not the Forge tab wording', () => {
    expect(applyStartRefusalText('offline', en)).toBe(en.applyStartOffline);
    expect(applyStartRefusalText('offline', en)).not.toBe(en.forgeReasonFixture);
  });

  it('bad_request names a request the game did not understand', () => {
    expect(applyStartRefusalText('bad_request', en)).toBe(en.applyStartBadRequest);
  });

  it('nothing_to_apply reads the shared "build the plan again" wording', () => {
    expect(applyStartRefusalText('nothing_to_apply', en)).toBe(en.applyStartNothing);
  });
});

describe('formatClock', () => {
  it('is m:ss past a minute', () => {
    expect(formatClock(85_000)).toBe('1:25');
  });
});

describe('unitCardText', () => {
  function unit(overrides: Partial<ApplyUnitLabel>): ApplyUnitLabel {
    return { index: 0, call: 'equip', subject: 'Crimson Weapon +12', from: null, to: null, points: null, gold: 0, ...overrides };
  }

  it('prints each call kind the way the modal card names it', () => {
    expect(unitCardText(unit({ call: 'equip', from: 'Orin', to: 'Bram' }), en)).toBe('Orin → Crimson Weapon +12 → Bram');
    expect(unitCardText(unit({ call: 'equip', from: null, to: 'Bram' }), en)).toBe('Inventory → Crimson Weapon +12 → Bram');
    expect(unitCardText(unit({ call: 'unequip', from: 'Orin', to: null }), en)).toBe('Crimson Weapon +12 → Inventory');
    expect(unitCardText(unit({ call: 'respec', subject: 'Bram', points: 24 }), en)).toBe('Bram — respec, then 24 points');
    expect(unitCardText(unit({ call: 'commit', subject: 'Bram', points: 24 }), en)).toBe('Bram — place 24 points');
  });
});

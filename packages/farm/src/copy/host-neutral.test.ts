import { describe, expect, it } from 'vitest';
import { farmEn } from './en';
import { farmPtBR } from './pt-BR';

/**
 * This package's screen is drawn by two apps, and they do not have the same screens. The web
 * planner's pages and the desktop app's tabs share only some names, so a sentence here that sends
 * a player to another screen is true on one app and false on the other — a host draws such a
 * pointer from its own dictionary, and this keeps the shared copy from growing one back.
 */
const HOST_ONLY_DESTINATIONS = [/team plan/i, /plano do time/i, /planner page/i];

describe('shared farm copy names no screen a host may not have', () => {
  it('no string in either language points at another page', () => {
    const offenders: string[] = [];
    for (const [lang, copy] of [
      ['en', farmEn],
      ['pt-BR', farmPtBR],
    ] as const) {
      for (const [key, value] of Object.entries(copy)) {
        for (const pattern of HOST_ONLY_DESTINATIONS) {
          if (pattern.test(value)) offenders.push(`${lang}.${key} matched ${pattern}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('red state: the same scan catches a pointer added to the shared copy', () => {
    const withPointer = { ...farmEn, farmFabricatedPointer: 'Use the Team plan page instead.' };
    const caught = Object.values(withPointer).some((value) =>
      HOST_ONLY_DESTINATIONS.some((pattern) => pattern.test(value)),
    );
    expect(caught).toBe(true);
  });
});

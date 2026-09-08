import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { farmEn } from './en';
import { farmPtBR } from './pt-BR';

/**
 * This package's screen is drawn by two apps, and they do not have the same screens. The web
 * planner has a Team plan page; the desktop app's pages are farm, inventory, live, mini-live and
 * settings, and nothing there does gear moves at all. So a sentence here that sends a player to
 * another screen is true on one app and false on the other — the host supplies that half instead
 * (`FarmRespecPanel`'s `scopeNote`), and this keeps the shared copy from growing one back.
 */
const HOST_ONLY_DESTINATIONS = [/team plan/i, /plano do time/i, /planner page/i];

const panelSource = readFileSync(
  fileURLToPath(new URL('../components/farm-respec-panel.tsx', import.meta.url)),
  'utf8',
);

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
    const withPointer = { ...farmEn, farmRespecPointsOnly: 'Use the Team plan page instead.' };
    const caught = Object.values(withPointer).some((value) =>
      HOST_ONLY_DESTINATIONS.some((pattern) => pattern.test(value)),
    );
    expect(caught).toBe(true);
  });
});

describe('the respec panel states its own scope', () => {
  it('renders the points-only sentence unconditionally', () => {
    expect(panelSource).toContain('t.farmRespecPointsOnly');
    expect(panelSource).toContain('data-testid="farm-respec-points-only"');
  });

  it('renders the host continuation only when the host supplies one', () => {
    expect(panelSource).toContain('scopeNote ?');
  });

  it('says the advisor moves points and nothing else, in both languages', () => {
    expect(farmEn.farmRespecPointsOnly).toMatch(/only moves stat points/i);
    expect(farmEn.farmRespecPointsOnly).toMatch(/never (moves )?gear/i);
    expect(farmPtBR.farmRespecPointsOnly).toMatch(/só mexe em pontos/i);
    expect(farmPtBR.farmRespecPointsOnly).toMatch(/nunca move itens/i);
  });
});

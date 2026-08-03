import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { dialogBackdropClass, dialogPopupClass } from '@bombfarm/ui/dialog.recipe';

const dialogBackdropClassExpected =
  'fixed inset-0 z-40 bg-[color-mix(in_oklch,black_55%,transparent)]';

const legacyPopupClass =
  'fixed top-1/2 left-1/2 z-[41] flex max-h-[min(85vh,900px)] w-[min(92vw,760px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden border border-line bg-surface p-4 pb-0';

const uiRoot = join(dirname(fileURLToPath(import.meta.url)), '../../../../packages/ui/src');

const forbiddenImportPatterns = [
  /from '@\/components\/(panels|roster|gear|hero-planner|chrome)/,
  /from '@\/lib\/(model|gear|derive|storage|advisor|loadout|planner-constants)/,
];

function readUiSource(relativePath: string): string {
  return readFileSync(join(uiRoot, relativePath), 'utf8');
}

describe('dialog recipe parity', () => {
  it('dialogBackdropClass uses a dark scrim (not light ink wash)', () => {
    expect(dialogBackdropClass).toBe(dialogBackdropClassExpected);
  });

  it('dialogPopupClass matches legacy import dialog popup', () => {
    expect(dialogPopupClass).toBe(legacyPopupClass);
  });
});

describe('Dialog shell DS-09 imports', () => {
  for (const file of [
    'dialog/dialog-root.tsx',
    'dialog/dialog-portal.tsx',
    'dialog/dialog-backdrop.tsx',
    'dialog/dialog-popup.tsx',
    'dialog/dialog-head.tsx',
    'dialog/dialog-title.tsx',
    'dialog/dialog-close.tsx',
    'dialog/index.ts',
    'dialog.recipe.ts',
    'confirm-dialog.tsx',
  ]) {
    it(`${file} has no forbidden feature or domain lib imports`, () => {
      const source = readUiSource(file);
      for (const pattern of forbiddenImportPatterns) {
        expect(source).not.toMatch(pattern);
      }
    });
  }
});

describe('ConfirmDialog barrel', () => {
  it('is exported from the ui index', async () => {
    const ui = await import('@bombfarm/ui');
    expect(ui.ConfirmDialog).toBeDefined();
  });
});

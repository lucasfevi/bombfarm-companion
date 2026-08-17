import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileDropZoneRecipe } from '@bombfarm/ui/file-drop-zone.recipe';
import { WEB_PACKAGE_ROOT } from './helpers/web-package-root';

const IDLE =
  'flex cursor-pointer flex-col items-center gap-2.5 border border-dashed border-line bg-bg px-4 py-8 text-center text-xs text-muted';
const DRAG_OVER =
  'flex cursor-pointer flex-col items-center gap-2.5 border border-dashed border-accent bg-[color-mix(in_oklch,var(--accent)_8%,var(--bg))] px-4 py-8 text-center text-xs text-muted';

describe('FileDropZone', () => {
  it('recipe idle / dragOver states match frozen import-dialog literals', () => {
    expect(fileDropZoneRecipe({ dragOver: false })).toBe(IDLE);
    expect(fileDropZoneRecipe({ dragOver: true })).toBe(DRAG_OVER);
  });

  it('keeps role=button, tabIndex, Enter/Space, and input value reset in source', () => {
    const src = fs.readFileSync(
      path.resolve(WEB_PACKAGE_ROOT, '../../packages/ui/src/file-drop-zone.tsx'),
      'utf8',
    );
    expect(src).toContain('role="button"');
    expect(src).toContain('tabIndex={0}');
    expect(src).toContain("event.key === 'Enter' || event.key === ' '");
    expect(src).toContain("event.target.value = ''");
  });
});

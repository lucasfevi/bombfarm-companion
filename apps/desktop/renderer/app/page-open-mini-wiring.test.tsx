import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('page.tsx — the Open-mini control sits in the header beside the language toggle', () => {
  const source = readFileSync(join(__dirname, 'page.tsx'), 'utf8');
  const actionsStart = source.indexOf('actions={');
  const actions = source.slice(actionsStart, source.indexOf('status={', actionsStart));

  it('renders the control inside the shell actions slot, not inside the Live view', () => {
    expect(actionsStart).toBeGreaterThanOrEqual(0);
    expect(actions).toContain('<OpenMiniButton />');
    expect(actions).toContain('<SegmentedToggle');
  });

  it('withholds the control until account access is granted, like the nav items', () => {
    expect(actions).toContain('granted ? <OpenMiniButton /> : null');
  });

  it('opens through miniLive:open and carries an icon beside its label', () => {
    expect(source).toContain("'miniLive:open'");
    expect(source).toContain('<Icon name="window" size="sm" />');
    expect(source).toContain('{t.miniLiveOpenLabel}');
  });
});

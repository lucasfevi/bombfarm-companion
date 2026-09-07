import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('the Open-mini control sits in the header actions, not in the Live view', () => {
  const page = readFileSync(join(__dirname, 'page.tsx'), 'utf8');
  const actions = readFileSync(join(__dirname, 'shell-actions.tsx'), 'utf8');

  it('reaches the shell through its actions slot', () => {
    const actionsStart = page.indexOf('actions={');
    expect(actionsStart).toBeGreaterThanOrEqual(0);
    expect(page.slice(actionsStart, page.indexOf('status={', actionsStart))).toContain('<ShellActions');
  });

  it('withholds the control until account access is granted, like the nav items', () => {
    expect(actions).toContain('granted ? <OpenMiniButton /> : null');
    expect(actions).toContain('granted ? <OpenMiniMenuItem /> : null');
  });

  it('opens through miniLive:open and carries an icon beside its label, in both shapes', () => {
    expect(actions).toContain("'miniLive:open'");
    expect(actions.match(/<Icon name="window" size="sm" \/>/g)).toHaveLength(2);
    expect(actions.match(/\{t\.miniLiveOpenLabel\}/g)).toHaveLength(2);
  });
});

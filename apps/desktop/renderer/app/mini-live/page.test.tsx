import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('mini-live page shell', () => {
  const source = readFileSync(join(__dirname, 'page.tsx'), 'utf8');

  it('does not import AppShell, Farm, or Settings views', () => {
    expect(source).not.toMatch(/from '\.\.\/farm\//);
    expect(source).not.toMatch(/from '\.\.\/settings\//);
    expect(source).not.toContain('AppShell');
    expect(source).not.toContain('ConsentModal');
    expect(source).not.toContain('ConsentGate');
  });

  it('loads layout through miniLive:getLayout', () => {
    expect(source).toContain("'miniLive:getLayout'");
  });

  it('closes through miniLive:close', () => {
    expect(source).toContain("'miniLive:close'");
  });

  it('sets native title on the gear control', () => {
    expect(source).toContain('miniLiveGearTitle');
  });
});

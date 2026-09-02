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

  it('routes gear layout changes through miniLive:setLayout', () => {
    expect(source).toContain("'miniLive:setLayout'");
  });

  it('measures content for miniLive:fitGrowthAxis after layout changes and once when live data lands, never per tick', () => {
    expect(source).toContain("'miniLive:fitGrowthAxis'");
    expect(source).toContain('}, [layout, hasLiveData]);');
    expect(source).not.toContain('model.earnings, model.map, model.slow');
  });
});

describe('mini-live section layout', () => {
  const source = readFileSync(join(__dirname, 'page.tsx'), 'utf8');

  it('defaults to earnings and map on with heroes off', () => {
    expect(source).toContain('showEarnings: true');
    expect(source).toContain('showMap: true');
    expect(source).toContain('showHeroes: false');
    expect(source).toContain("axis: 'vertical'");
  });

  it('renders earnings, map, and heroes only when their layout flags are on', () => {
    expect(source).toContain('layout.showEarnings ?');
    expect(source).toContain('layout.showMap ?');
    expect(source).toContain('layout.showHeroes ?');
  });

  it('uses a horizontal row when the growth axis is horizontal', () => {
    expect(source).toContain("layout.axis === 'horizontal'");
    expect(source).toContain('flex-row');
    expect(source).toContain('data-axis="horizontal"');
    expect(source).toContain('data-axis="vertical"');
  });

  it('lets the heroes section fill leftover height instead of clipping into empty window space', () => {
    expect(source).toContain('overflow-hidden');
    expect(source).toContain('flex-1 flex-col');
    expect(source).toContain('readMiniLiveFitSize(root, content, layout.axis)');
  });
});

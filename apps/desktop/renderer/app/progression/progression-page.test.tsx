// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { CopyProvider } from '../../lib/copy';
import { en } from '../../lib/copy/en';
import { ptBR } from '../../lib/copy/pt-BR';
import type { ProgressionPageId } from '../../lib/progression/progression-page-store';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('../skills/skills-view', () => ({
  SkillsView: () => createElement('div', { 'data-testid': 'skills-view' }),
}));
vi.mock('../collections/collections-view', () => ({
  CollectionsView: () => createElement('div', { 'data-testid': 'collections-view' }),
}));

const { ProgressionPage } = await import('./progression-page');

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() });
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
    await Promise.resolve();
  });
  container.remove();
});

async function show(page: ProgressionPageId, locale: 'en' | 'pt-BR' = 'en', onPageChange = vi.fn()) {
  await act(async () => {
    root.render(
      <CopyProvider locale={locale}>
        <ProgressionPage page={page} onPageChange={onPageChange} />
      </CopyProvider>,
    );
    await Promise.resolve();
  });
  return onPageChange;
}

function tabs(): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>('[role="tab"]')];
}

function tabNamed(name: string): HTMLElement {
  const found = tabs().find((tab) => tab.textContent.trim() === name);
  if (!found) throw new Error(`no tab named ${name}`);
  return found;
}

async function press(element: Element): Promise<void> {
  await act(async () => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await Promise.resolve();
  });
}

describe('the Skill Tree | Collections switch', () => {
  it('offers Skill Tree then Collections as tabs, in English', async () => {
    await show('skills');
    expect(tabs().map((tab) => tab.textContent.trim())).toEqual(['Skill Tree', 'Collections']);
  });

  it('offers Árvore then Coleções as tabs, in Portuguese', async () => {
    await show('skills', 'pt-BR');
    expect(tabs().map((tab) => tab.textContent.trim())).toEqual([ptBR.skillsNavLabel, ptBR.collectionsNavLabel]);
  });

  it('names the switch group with the Progression pages copy in both languages', async () => {
    await show('skills');
    expect(container.querySelector('[role="group"]')?.getAttribute('aria-label')).toBe('Progression pages');
    await show('skills', 'pt-BR');
    expect(container.querySelector('[role="group"]')?.getAttribute('aria-label')).toBe(ptBR.progressionSwitchLabel);
    expect(ptBR.progressionSwitchLabel).not.toBe(en.progressionSwitchLabel);
  });

  it('shows the Skill Tree view alone, with its tab selected, on the skills page', async () => {
    await show('skills');
    expect(tabNamed('Skill Tree').getAttribute('aria-selected')).toBe('true');
    expect(tabNamed('Collections').getAttribute('aria-selected')).toBe('false');
    expect(container.querySelector('[data-testid="skills-view"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="collections-view"]')).toBeNull();
  });

  it('shows the Collections view alone, with its tab selected, on the collections page', async () => {
    await show('collections');
    expect(tabNamed('Collections').getAttribute('aria-selected')).toBe('true');
    expect(container.querySelector('[data-testid="collections-view"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="skills-view"]')).toBeNull();
    expect(container.querySelector('[data-testid="progression-page"]')?.getAttribute('data-page')).toBe('collections');
  });

  it('asks for the page whose tab was pressed', async () => {
    const onPageChange = await show('skills');
    await press(tabNamed('Collections'));
    expect(onPageChange).toHaveBeenCalledWith('collections');
  });

  it('asks for the skills page when its tab is pressed from Collections', async () => {
    const onPageChange = await show('collections');
    await press(tabNamed('Skill Tree'));
    expect(onPageChange).toHaveBeenCalledWith('skills');
  });
});

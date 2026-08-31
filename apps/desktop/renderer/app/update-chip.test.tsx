import type { UpdatePhase, UpdateStatus } from '@bombfarm/contracts';
import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CopyProvider } from '../lib/copy';
import { UpdateChip } from './update-chip';

function status(overrides: Partial<UpdateStatus> = {}): UpdateStatus {
  return {
    phase: 'idle',
    currentVersion: '0.7.1',
    channel: 'latest',
    availableVersion: null,
    percent: null,
    error: null,
    lastCheckedAt: null,
    ...overrides,
  };
}

function render(locale: 'en' | 'pt-BR', value: UpdateStatus) {
  return renderToStaticMarkup(
    createElement(CopyProvider, {
      locale,
      children: createElement(UpdateChip, { status: value, onOpenSettings: vi.fn() }),
    }),
  );
}

const SILENT_PHASES: UpdatePhase[] = ['idle', 'checking', 'not-available', 'error', 'disabled'];

describe('UpdateChip', () => {
  it('announces an available update in both locales', () => {
    expect(render('en', status({ phase: 'available', availableVersion: '0.7.2' }))).toContain('Update available');
    expect(render('pt-BR', status({ phase: 'available', availableVersion: '0.7.2' }))).toContain(
      'Atualização disponível',
    );
  });

  it('stays through the download rather than vanishing when one starts', () => {
    const html = render('en', status({ phase: 'downloading', availableVersion: '0.7.2', percent: 42 }));

    expect(html).toContain('Updating… 42%');
    expect(html).toContain('data-phase="downloading"');
  });

  it('ends on the restart prompt', () => {
    expect(render('en', status({ phase: 'ready', availableVersion: '0.7.2', percent: 100 }))).toContain(
      'Restart to update',
    );
    expect(render('pt-BR', status({ phase: 'ready', availableVersion: '0.7.2', percent: 100 }))).toContain(
      'Reinicie para atualizar',
    );
  });

  it('renders nothing at all for the phases the player cannot act on', () => {
    for (const phase of SILENT_PHASES) {
      expect(render('en', status({ phase }))).toBe('');
    }
  });

  it('is a button, so it can be reached by keyboard and says where it leads', () => {
    const html = render('en', status({ phase: 'available', availableVersion: '0.7.2' }));

    expect(html).toMatch(/<button[^>]*data-testid="shell-update-chip"/);
    expect(html).toContain('Open the Updates settings');
  });
});

import type { UpdateStatus } from '@bombfarm/contracts';
import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CopyProvider } from '../../lib/copy';
import { UpdatesSection } from './updates-section';

function status(overrides: Partial<UpdateStatus> = {}): UpdateStatus {
  return {
    phase: 'idle',
    currentVersion: '1.2.3',
    channel: 'beta',
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
      children: createElement(UpdatesSection, {
        status: value,
        onCheck: vi.fn(),
        onDownload: vi.fn(),
        onInstall: vi.fn(),
      }),
    }),
  );
}

describe('UpdatesSection: the control renders in both locales', () => {
  it('English: title, installed version, channel and the check action come from copy', () => {
    const html = render('en', status());
    expect(html).toContain('Updates');
    expect(html).toContain('Installed version');
    expect(html).toContain('v1.2.3');
    expect(html).toContain('Update channel: beta.');
    expect(html).toContain('Check now');
  });

  it('PT-BR: the same surface is translated', () => {
    const html = render('pt-BR', status());
    expect(html).toContain('Atualizações');
    expect(html).toContain('Versão instalada');
    expect(html).toContain('Canal de atualização: beta.');
    expect(html).toContain('Procurar agora');
  });

  it('omits the channel line when there is none, rather than printing an empty one', () => {
    const html = render('en', status({ phase: 'disabled', channel: null }));
    expect(html).not.toContain('Update channel');
  });
});

describe('UpdatesSection: one action is offered at a time, matching the phase', () => {
  it('available offers Download and not Check — a check would be discarded by main', () => {
    const html = render('en', status({ phase: 'available', availableVersion: '1.3.0' }));
    expect(html).toContain('data-testid="settings-updates-download"');
    expect(html).not.toContain('data-testid="settings-updates-check"');
  });

  it('ready offers the restart action instead', () => {
    const html = render('en', status({ phase: 'ready', availableVersion: '1.3.0', percent: 100 }));
    expect(html).toContain('data-testid="settings-updates-install"');
    expect(html).toContain('Restart and install');
    expect(html).not.toContain('data-testid="settings-updates-download"');
  });

  it('the row label names whatever its button does, in both languages', () => {
    expect(render('en', status())).toContain('Check for updates');
    expect(render('en', status({ phase: 'available', availableVersion: '1.3.0' }))).toContain(
      'A new version is waiting',
    );
    expect(render('en', status({ phase: 'ready', availableVersion: '1.3.0' }))).toContain('Finish updating');
    expect(render('pt-BR', status({ phase: 'ready', availableVersion: '1.3.0' }))).toContain(
      'Terminar a atualização',
    );
    // The row never advertises a check while offering a different button.
    expect(render('en', status({ phase: 'ready', availableVersion: '1.3.0' }))).not.toContain('Check for updates');
  });

  it('disables the check button while a check is already running', () => {
    const html = render('en', status({ phase: 'checking' }));
    expect(html).toContain('data-testid="settings-updates-check"');
    expect(html).toMatch(/data-testid="settings-updates-check"[^>]*disabled/);
  });

  it('shows a progress bar only while downloading', () => {
    expect(render('en', status({ phase: 'downloading', availableVersion: '1.3.0', percent: 42 }))).toContain(
      'data-testid="settings-updates-progress"',
    );
    expect(render('en', status({ phase: 'available' }))).not.toContain('data-testid="settings-updates-progress"');
  });
});

describe('UpdatesSection: the status Banner is an always-mounted slot (docs/no-layout-shift.md rule 1)', () => {
  it('idle: the slot is present, empty, and hidden', () => {
    const html = render('en', status());
    expect(html).toContain('data-testid="settings-updates-status"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain('latest version');
  });

  it('names the version in the available, downloading and ready messages', () => {
    expect(render('en', status({ phase: 'available', availableVersion: '1.3.0' }))).toContain(
      'Version 1.3.0 is available',
    );
    expect(render('en', status({ phase: 'downloading', availableVersion: '1.3.0', percent: 42 }))).toContain(
      'Downloading version 1.3.0… 42%',
    );
    expect(render('en', status({ phase: 'ready', availableVersion: '1.3.0' }))).toContain(
      'Version 1.3.0 is ready to install',
    );
  });

  it('renders each error reason as its own translated sentence, never as updater prose', () => {
    expect(render('en', status({ phase: 'error', error: 'offline' }))).toContain('Could not reach the update server');
    expect(render('en', status({ phase: 'error', error: 'rate-limited' }))).toContain('asking us to slow down');
    expect(render('en', status({ phase: 'error', error: 'no-release' }))).toContain('no published release');
    expect(render('pt-BR', status({ phase: 'error', error: 'offline' }))).toContain(
      'acessar o servidor de atualizações',
    );
  });

  it('explains a dev build rather than showing a check button that would do nothing', () => {
    const html = render('en', status({ phase: 'disabled', channel: null }));
    expect(html).toContain('Updates are off in this build');
    expect(html).toMatch(/data-testid="settings-updates-check"[^>]*disabled/);
  });
});

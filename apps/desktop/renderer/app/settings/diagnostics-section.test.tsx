import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CopyProvider } from '../../lib/copy';
import { DiagnosticsSection } from './diagnostics-section';

function render(locale: 'en' | 'pt-BR', result: Parameters<typeof DiagnosticsSection>[0]['result']) {
  return renderToStaticMarkup(
    createElement(CopyProvider, {
      locale,
      children: createElement(DiagnosticsSection, { onSave: vi.fn(), result }),
    }),
  );
}

describe('DiagnosticsSection: the control renders in both locales', () => {
  it('English: label, help text, and the save action all come from copy', () => {
    const html = render('en', null);
    expect(html).toContain('Save a bug report file');
    expect(html).toContain('Nothing is sent anywhere');
    expect(html).toContain('data-testid="settings-diagnostics-save"');
    expect(html).toContain('Save file');
  });

  it('PT-BR: label, help text, and the save action are all translated', () => {
    const html = render('pt-BR', null);
    expect(html).toContain('Salvar arquivo para relatório de erro');
    expect(html).toContain('Nada é enviado a lugar nenhum');
    expect(html).toContain('Salvar arquivo');
  });
});

describe('DiagnosticsSection: the result Banner is an always-mounted slot (docs/no-layout-shift.md rule 1)', () => {
  it('no result yet: the slot is present, empty, and hidden', () => {
    const html = render('en', null);
    expect(html).toContain('data-testid="settings-diagnostics-save-result"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain('File saved');
    expect(html).not.toContain('Nothing saved');
  });

  it('a successful write: the slot is visible and names the destination path', () => {
    const html = render('en', { written: true, path: 'C:\\Users\\player\\live-frame-dump.json' });
    expect(html).toContain('aria-hidden="false"');
    expect(html).toContain('File saved');
    expect(html).toContain('C:\\Users\\player\\live-frame-dump.json');
  });

  it('a rate-limited call: reported honestly, not as a silent success', () => {
    const html = render('en', { written: false, reason: 'rate-limited' });
    expect(html).toContain('aria-hidden="false"');
    expect(html).toContain('Nothing saved');
    expect(html).toContain('You just saved one');
    expect(html).not.toContain('File saved');
  });

  it('a failed write: reported honestly, not as a silent success', () => {
    const html = render('en', { written: false, reason: 'write-failed' });
    expect(html).toContain('Nothing saved');
    expect(html).toContain('The file could not be written');
  });

  it('no ring attached yet: reported honestly, not as a silent success', () => {
    const html = render('en', { written: false, reason: 'no-source' });
    expect(html).toContain('Nothing saved');
    expect(html).toContain('has not connected to the game');
  });

  it('PT-BR: a successful write names the destination path in the translated body', () => {
    const html = render('pt-BR', { written: true, path: 'C:\\Users\\player\\live-frame-dump.json' });
    expect(html).toContain('Arquivo salvo');
    expect(html).toContain('C:\\Users\\player\\live-frame-dump.json');
  });
});

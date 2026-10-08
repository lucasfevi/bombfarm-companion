import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CopyProvider } from '../lib/copy';
import type { DataNotice } from '../lib/account/data-notices';
import { DataNoticesBanner } from './data-notices-banner';

function render(locale: 'en' | 'pt-BR', notices: readonly DataNotice[]) {
  return renderToStaticMarkup(
    createElement(CopyProvider, { locale, children: createElement(DataNoticesBanner, { notices }) }),
  );
}

const FIVE_MINUTES_AGO = new Date(Date.now() - 5 * 60_000).toISOString();

describe('DataNoticesBanner', () => {
  it('says the game changed the skill tree and shows the last one read, with how old it is, in English', () => {
    const html = render('en', [{ kind: 'skillTreeStale', capturedAt: FIVE_MINUTES_AGO }]);
    expect(html).toContain('The game changed how it sends your skill tree. Showing the last one we read (5m ago).');
  });

  it('says the same in Portuguese', () => {
    const html = render('pt-BR', [{ kind: 'skillTreeStale', capturedAt: FIVE_MINUTES_AGO }]);
    expect(html).toContain('O jogo mudou a forma de enviar sua árvore de habilidades. Mostrando a última que lemos (há 5m).');
  });

  it('says the tree cannot be read until the app is updated when none was ever saved, in both languages', () => {
    expect(render('en', [{ kind: 'skillTreeWithheld' }])).toContain("can&#x27;t read it until it is updated");
    expect(render('pt-BR', [{ kind: 'skillTreeWithheld' }])).toContain('não consegue lê-la até ser atualizado');
  });

  it('puts the explanation behind an info icon instead of in the line', () => {
    const html = render('en', [{ kind: 'gearOwnerUnknown' }]);
    expect(html).toContain('Some gear is left out because the game stopped saying who wears it.');
    expect(html).toContain('aria-label="What this means: ');
  });

  it('lists one line per notice', () => {
    const html = render('en', [{ kind: 'skillTreeWithheld' }, { kind: 'gearFieldsAbsent' }]);
    expect(html).toContain('data-notice-skillTreeWithheld');
    expect(html).toContain('data-notice-gearFieldsAbsent');
  });
});

import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { CONSENT_TEXT, CONSENT_TEXT_VERSION, consentTextFor } from './consent-text.js';

/** The sha256 of each locale's `body.map((c) => \`${c.heading}\n${c.text}\`).join('\n')` at each
 *  `version` it has ever shipped under. Recompute and add a new key — for BOTH locales — when
 *  `CONSENT_TEXT_VERSION` is bumped, so editing either language's text without bumping the shared
 *  version fails here. `en`'s `1` entry predates the pt-BR translation, which shipped starting at
 *  version 2. */
const KNOWN_BODY_DIGESTS: Readonly<Record<'en' | 'pt-BR', Readonly<Record<number, string>>>> = {
  en: {
    1: '4353ef5f05a0ae24b720b46af0f8967949e8b590495d32d45b727ada1b212779',
    2: '6821259f4832b5e77f0ce6f5b8d8c8ddd8dcda0f91b1887e4308df1db422aac2',
    3: '899613bee52877b8e3a66e2864500117f8cc239abf0288f0a3964acc5bca8ec4',
    4: 'bedbd31213ce49606ceadb85774b1c322fdda20fe35582fa02402295a8cb2baa',
  },
  'pt-BR': {
    2: '1aa62c031159c769ae95530b147d7dc2f9eafdc3229f06e27a7d3d56ce0d886d',
    3: '2045be379089bf57ef168741f42e734de7d31e93bb17179ea97c4b5cd91d54fa',
    4: '24d67f662e7a0dcd3c7cc4aeb45d797e67b94028e9185c1a596f625a4713d3c0',
  },
};

describe.each([
  ['en', CONSENT_TEXT.en] as const,
  ['pt-BR', CONSENT_TEXT['pt-BR']] as const,
])('CONSENT_TEXT.%s', (locale, text) => {
  it('has a title and both button labels', () => {
    expect(text.title.length).toBeGreaterThan(0);
    expect(text.acceptLabel.length).toBeGreaterThan(0);
    expect(text.declineLabel.length).toBeGreaterThan(0);
  });

  it('carries exactly the five clauses', () => {
    expect(text.body).toHaveLength(5);
  });

  it('is stamped with the shared CONSENT_TEXT_VERSION', () => {
    expect(text.version).toBe(CONSENT_TEXT_VERSION);
  });

  it('binds body to its version — editing the text without bumping CONSENT_TEXT_VERSION fails', () => {
    const digest = createHash('sha256')
      .update(text.body.map((clause) => `${clause.heading}\n${clause.text}`).join('\n'))
      .digest('hex');
    expect(KNOWN_BODY_DIGESTS[locale][text.version]).toBeDefined();
    expect(digest).toBe(KNOWN_BODY_DIGESTS[locale][text.version]);
  });
});

describe('consentTextFor', () => {
  it('returns the en entry for "en"', () => {
    expect(consentTextFor('en')).toBe(CONSENT_TEXT.en);
  });

  it('returns the pt-BR entry for "pt-BR"', () => {
    expect(consentTextFor('pt-BR')).toBe(CONSENT_TEXT['pt-BR']);
  });
});

describe('CONSENT_TEXT.en — clause content', () => {
  const { body } = CONSENT_TEXT.en;

  it('states the attach, and that it reads traffic the client already exchanges', () => {
    const clause = body.find((c) => c.heading === 'Reads your account.');
    expect(clause).toBeDefined();
    expect(clause?.text).toMatch(/attaches to the running game client/i);
    expect(clause?.text).toMatch(/traffic that client is already exchanging/i);
  });

  it('states the one write it can make, the three gates in front of it, and that nothing else can change the account, the client, or progress', () => {
    const clause = body.find((c) => c.heading === 'Writes only when you tell it to.');
    expect(clause).toBeDefined();
    expect(clause?.text).toMatch(/^Everything it shows is read\./);
    expect(clause?.text).toMatch(/the same two calls the game's own forge screen makes/i);
    expect(clause?.text).toMatch(/only from the Forge tab/i);
    expect(clause?.text).toContain('only after you turn on "Let Forge spend gold" in Settings');
    expect(clause?.text).toMatch(/only after you confirm each run/i);
    expect(clause?.text).toMatch(/Nothing else in it can change your account, your game client, or your progress/);
  });

  it('states the token goes to one host and never into a log', () => {
    const clause = body.find((c) => c.heading === 'Your token stays put.');
    expect(clause).toBeDefined();
    expect(clause?.text).toContain('app.bombfarm.net');
    expect(clause?.text).toMatch(/never into a log/i);
  });

  it('states ANTIVIRUS may flag or quarantine the companion, and why', () => {
    const clause = body.find((c) => c.heading === 'Antivirus may flag or quarantine it.');
    expect(clause).toBeDefined();
    expect(clause?.text).toContain(
      'Attaching to another running program is the technique behavior-based detection looks for',
    );
  });

  it('states it is detectable in principle, the consequence lands on the player, and it can be turned off', () => {
    const clause = body.find((c) => c.heading === 'The risk is yours.');
    expect(clause).toBeDefined();
    expect(clause?.text).toMatch(/detectable in principle/i);
    expect(clause?.text).toMatch(/consequence falls on your account/i);
    expect(clause?.text).toMatch(/turn it off at any time/i);
  });
});

describe('CONSENT_TEXT["pt-BR"] — clause content, the same facts in Portuguese', () => {
  const { body } = CONSENT_TEXT['pt-BR'];

  it('states the attach, and that it reads traffic the client already exchanges', () => {
    const clause = body.find((c) => c.heading === 'Lê sua conta.');
    expect(clause).toBeDefined();
    expect(clause?.text).toMatch(/conectando-se ao cliente do jogo em execução/i);
    expect(clause?.text).toMatch(/tráfego que esse cliente já troca/i);
  });

  it('states the one write it can make, the three gates in front of it, and that nothing else can change the account, the client, or progress', () => {
    const clause = body.find((c) => c.heading === 'Escreve só quando você manda.');
    expect(clause).toBeDefined();
    expect(clause?.text).toMatch(/^Tudo o que ele mostra é leitura\./);
    expect(clause?.text).toMatch(/as mesmas duas chamadas que a tela de forja do jogo faz/i);
    expect(clause?.text).toMatch(/só pela aba Forja/i);
    expect(clause?.text).toContain('só depois que você ligar "Deixar a Forja gastar ouro" nas Configurações');
    expect(clause?.text).toMatch(/só depois de confirmar cada execução/i);
    expect(clause?.text).toMatch(/Nada mais nele pode alterar sua conta, o cliente do jogo ou seu progresso/);
  });

  it('states the token goes to one host and never into a log', () => {
    const clause = body.find((c) => c.heading === 'Seu token não sai do lugar.');
    expect(clause).toBeDefined();
    expect(clause?.text).toContain('app.bombfarm.net');
    expect(clause?.text).toMatch(/nunca para um log/i);
  });

  it('states ANTIVIRUS may flag or quarantine the companion, and why', () => {
    const clause = body.find((c) => c.heading === 'O antivírus pode sinalizar ou colocar em quarentena.');
    expect(clause).toBeDefined();
    expect(clause?.text).toContain(
      'Conectar-se a outro programa em execução é a técnica que a detecção por comportamento procura',
    );
  });

  it('states it is detectable in principle, the consequence lands on the player, and it can be turned off', () => {
    const clause = body.find((c) => c.heading === 'O risco é seu.');
    expect(clause).toBeDefined();
    expect(clause?.text).toMatch(/detectável em princípio/i);
    expect(clause?.text).toMatch(/consequência recai sobre a sua conta/i);
    expect(clause?.text).toMatch(/desativar quando quiser/i);
  });
});

describe('CONSENT_TEXT — the two locales are not accidentally the same text', () => {
  it('en and pt-BR carry the same version', () => {
    expect(CONSENT_TEXT.en.version).toBe(CONSENT_TEXT['pt-BR'].version);
  });

  it('en and pt-BR carry the same number of clauses', () => {
    expect(CONSENT_TEXT['pt-BR'].body).toHaveLength(CONSENT_TEXT.en.body.length);
  });

  it('the pt-BR body is not byte-identical to the en body', () => {
    const flatten = (body: typeof CONSENT_TEXT.en.body) =>
      body.map((c) => `${c.heading}\n${c.text}`).join('\n');
    expect(flatten(CONSENT_TEXT['pt-BR'].body)).not.toBe(flatten(CONSENT_TEXT.en.body));
  });

  it('the pt-BR title and labels are not byte-identical to en', () => {
    expect(CONSENT_TEXT['pt-BR'].title).not.toBe(CONSENT_TEXT.en.title);
    expect(CONSENT_TEXT['pt-BR'].acceptLabel).not.toBe(CONSENT_TEXT.en.acceptLabel);
    expect(CONSENT_TEXT['pt-BR'].declineLabel).not.toBe(CONSENT_TEXT.en.declineLabel);
  });
});

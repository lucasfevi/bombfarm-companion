import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { CONSENT_TEXT, CONSENT_TEXT_VERSION, consentTextFor } from './consent-text.js';

/** The sha256 of each locale's `body.join('\n')` at each `version` it has ever shipped under.
 *  Recompute and add a new key — for BOTH locales — when `CONSENT_TEXT_VERSION` is bumped, so
 *  editing either language's text without bumping the shared version fails here. `en`'s `1` entry
 *  predates the pt-BR translation, which shipped starting at version 2. */
const KNOWN_BODY_DIGESTS: Readonly<Record<'en' | 'pt-BR', Readonly<Record<number, string>>>> = {
  en: {
    1: '4353ef5f05a0ae24b720b46af0f8967949e8b590495d32d45b727ada1b212779',
    2: 'aa131a69c42e9161560254449cb5fe70b05f5bfbb140963f86fe82e65abcfbf5',
  },
  'pt-BR': {
    2: 'ac31532fac1ec12785a75a37b0de0fe1fafda091a64e61fc422f5ec675277105',
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

  it('carries exactly the seven clauses', () => {
    expect(text.body).toHaveLength(7);
  });

  it('is stamped with the shared CONSENT_TEXT_VERSION', () => {
    expect(text.version).toBe(CONSENT_TEXT_VERSION);
  });

  it('binds body to its version — editing the text without bumping CONSENT_TEXT_VERSION fails', () => {
    const digest = createHash('sha256').update(text.body.join('\n')).digest('hex');
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

  it('states WHAT is used — the session token the game itself already uses', () => {
    const clause = body.find((p) => p.startsWith('What:'));
    expect(clause).toBeDefined();
    expect(clause).toMatch(/session token/i);
    expect(clause).toMatch(/game itself already/i);
  });

  it('states WHERE it is sent — api.bombfarm.net and nowhere else', () => {
    const clause = body.find((p) => p.startsWith('Where:'));
    expect(clause).toBeDefined();
    expect(clause).toContain('api.bombfarm.net');
    expect(clause).toMatch(/nowhere else|never sent to us or anyone else/i);
  });

  it('states ATTACHING — what the tap observes, and that it sends nothing and modifies neither the client nor game state', () => {
    const clause = body.find((p) => p.startsWith('Attaching:'));
    expect(clause).toBeDefined();
    expect(clause).toMatch(/observes the traffic/i);
    expect(clause).toMatch(/sends nothing of its own/i);
    expect(clause).toMatch(/does not modify the.*game client/i);
    expect(clause).toMatch(/does not modify your game state/i);
  });

  it('states access is READ-ONLY, with no code path that writes to the account', () => {
    const clause = body.find((p) => p.startsWith('Read-only:'));
    expect(clause).toBeDefined();
    expect(clause).toMatch(/read-only/i);
    expect(clause).toMatch(/changes nothing/i);
    expect(clause).toMatch(/no code.*path that writes to your account/i);
  });

  it('states ANTIVIRUS may flag or quarantine the companion, and why', () => {
    const clause = body.find((p) => p.startsWith('Antivirus:'));
    expect(clause).toBeDefined();
    expect(clause).toMatch(/flag or quarantine/i);
    expect(clause).toContain(
      'attaching to another running program is the technique behavior-based detection is built to look for',
    );
  });

  it('states ACCOUNT RISK — attaching is detectable in principle, and the consequence lands on the player', () => {
    const clause = body.find((p) => p.startsWith('Account risk:'));
    expect(clause).toBeDefined();
    expect(clause).toMatch(/detectable in principle/i);
    expect(clause).toMatch(/consequence lands on your account/i);
  });

  it('states the decision is REVERSIBLE, and that reversing it detaches from the game client', () => {
    const clause = body.find((p) => p.startsWith('Reversible:'));
    expect(clause).toBeDefined();
    expect(clause).toMatch(/turn this off later/i);
    expect(clause).toMatch(/detaches from the game client/i);
  });
});

describe('CONSENT_TEXT["pt-BR"] — clause content, the same facts in Portuguese', () => {
  const { body } = CONSENT_TEXT['pt-BR'];

  it('states WHAT is used — the session token the game itself already uses', () => {
    const clause = body.find((p) => p.startsWith('O que:'));
    expect(clause).toBeDefined();
    expect(clause).toMatch(/token de sessão/i);
    expect(clause).toMatch(/próprio jogo já salva/i);
  });

  it('states WHERE it is sent — api.bombfarm.net and nowhere else', () => {
    const clause = body.find((p) => p.startsWith('Para onde:'));
    expect(clause).toBeDefined();
    expect(clause).toContain('api.bombfarm.net');
    expect(clause).toMatch(/para mais nenhum lugar|nunca é enviado para nós/i);
  });

  it('states ATTACHING — what the tap observes, and that it sends nothing and modifies neither the client nor game state', () => {
    const clause = body.find((p) => p.startsWith('Conexão ao jogo:'));
    expect(clause).toBeDefined();
    expect(clause).toMatch(/observa o tráfego/i);
    expect(clause).toMatch(/não envia nada por conta própria/i);
    expect(clause).toMatch(/não modifica o programa do jogo/i);
    expect(clause).toMatch(/não modifica o estado da sua partida/i);
  });

  it('states access is READ-ONLY, with no code path that writes to the account', () => {
    const clause = body.find((p) => p.startsWith('Somente leitura:'));
    expect(clause).toBeDefined();
    expect(clause).toMatch(/somente leitura|apenas lê/i);
    expect(clause).toMatch(/não altera nada/i);
    expect(clause).toMatch(/não existe nenhum.*caminho no código que escreva na sua conta/i);
  });

  it('states ANTIVIRUS may flag or quarantine the companion, and why', () => {
    const clause = body.find((p) => p.startsWith('Antivírus:'));
    expect(clause).toBeDefined();
    expect(clause).toMatch(/sinalizar ou colocar.*em quarentena/i);
    expect(clause).toContain(
      'conectar-se a outro programa em execução é justamente a técnica que a detecção por comportamento procura',
    );
  });

  it('states ACCOUNT RISK — attaching is detectable in principle, and the consequence lands on the player', () => {
    const clause = body.find((p) => p.startsWith('Risco para a conta:'));
    expect(clause).toBeDefined();
    expect(clause).toMatch(/detectável em princípio/i);
    expect(clause).toMatch(/consequência recai sobre a sua conta/i);
  });

  it('states the decision is REVERSIBLE, and that reversing it detaches from the game client', () => {
    const clause = body.find((p) => p.startsWith('Reversível:'));
    expect(clause).toBeDefined();
    expect(clause).toMatch(/desativar isso depois/i);
    expect(clause).toMatch(/a conexão com o programa do jogo é encerrada/i);
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
    expect(CONSENT_TEXT['pt-BR'].body.join('\n')).not.toBe(CONSENT_TEXT.en.body.join('\n'));
  });

  it('the pt-BR title and labels are not byte-identical to en', () => {
    expect(CONSENT_TEXT['pt-BR'].title).not.toBe(CONSENT_TEXT.en.title);
    expect(CONSENT_TEXT['pt-BR'].acceptLabel).not.toBe(CONSENT_TEXT.en.acceptLabel);
    expect(CONSENT_TEXT['pt-BR'].declineLabel).not.toBe(CONSENT_TEXT.en.declineLabel);
  });
});

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
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
    5: 'af6606e267b4e3658e6f94380de76d3ba193da484f7eed966e48687e89aaafa7',
    6: 'b9036725ffdb60065b5e61de5afb0795491abec7d80c3fded6bb3692864a44ef',
    7: 'ab4e5e5f8e9eeac9952414d694b21b6442c8d7337f9a0f7d48c18c8e4d74cc64',
  },
  'pt-BR': {
    2: '1aa62c031159c769ae95530b147d7dc2f9eafdc3229f06e27a7d3d56ce0d886d',
    3: '2045be379089bf57ef168741f42e734de7d31e93bb17179ea97c4b5cd91d54fa',
    4: '24d67f662e7a0dcd3c7cc4aeb45d797e67b94028e9185c1a596f625a4713d3c0',
    5: 'f7d2821ba7eb64b92afd3da592b682e36d190905378a40b7500d1a876480dd6d',
    6: '987b939a339e6195be69d6c972278211b83b9c130dba781fe9733a3ae0517182',
    7: '5f232fc20b21d4bc160b6f767e7167f9dccfb1670165db4b5a5efc5c7d5e798d',
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

  it('carries exactly the six clauses', () => {
    expect(text.body).toHaveLength(6);
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

  it('states every write it can make including burning items, the three gates in front of them, and that nothing else can change the account, the client, or progress', () => {
    const clause = body.find((c) => c.heading === 'Writes only when you tell it to.');
    expect(clause).toBeDefined();
    expect(clause?.text).toMatch(/^Everything it shows is read\./);
    expect(clause?.text).toMatch(/forge roll/i);
    expect(clause?.text).toMatch(/equip/i);
    expect(clause?.text).toMatch(/stat points|reset points/i);
    expect(clause?.text).toMatch(/burning items for Forge Essence/);
    expect(clause?.text).toMatch(/Deconstruct page/);
    expect(clause?.text).toMatch(/Forge tab/);
    expect(clause?.text).toMatch(/forge queue/i);
    expect(clause?.text).toMatch(/Optimizer/);
    expect(clause?.text).toContain('only after you turn on "Let the app forge, equip and reset points" in Settings');
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

  it('states every write it can make including burning items, the three gates in front of them, and that nothing else can change the account, the client, or progress', () => {
    const clause = body.find((c) => c.heading === 'Escreve só quando você manda.');
    expect(clause).toBeDefined();
    expect(clause?.text).toMatch(/^Tudo o que ele mostra é leitura\./);
    expect(clause?.text).toMatch(/rolagem de forja/i);
    expect(clause?.text).toMatch(/equipar/i);
    expect(clause?.text).toMatch(/pontos de status/i);
    expect(clause?.text).toMatch(/queimar itens para obter Essência de Forja/);
    expect(clause?.text).toMatch(/página Desconstruir/);
    expect(clause?.text).toMatch(/aba Forja/);
    expect(clause?.text).toMatch(/fila de forja/i);
    expect(clause?.text).toMatch(/Otimizador/);
    expect(clause?.text).toContain('só depois que você ligar "Deixar o app forjar, equipar e redistribuir pontos" nas Configurações');
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

const copyMap = (file: string): string =>
  readFileSync(fileURLToPath(new URL(`../../../apps/desktop/renderer/lib/copy/${file}`, import.meta.url)), 'utf8');

describe.each([
  {
    locale: 'en' as const,
    file: 'en.ts',
    heading: 'Keeps running in the background.',
    label: 'Restart Bomb Farm if it exits',
    tab: 'Live',
    unchanged: [
      ['Reads your account.', "Two ways: it calls the game's own server with the session token the game already saves on your machine, and it attaches to the running game client to read the traffic that client is already exchanging with that server."],
      ['Writes only when you tell it to.', 'Everything it shows is read. The writes it can make are a forge roll, equipping or unequipping an item, refunding and re-placing a hero\'s stat points, and burning items for Forge Essence — from the Forge tab (its Deconstruct page included), the forge queue, and the Optimizer\'s Apply steps, only after you turn on "Let the app forge, equip and reset points" in Settings, and only after you confirm each run. Nothing else in it can change your account, your game client, or your progress.'],
      ['Your token stays put.', 'It is sent only to app.bombfarm.net — never to us, never to anyone else, never into a log.'],
      ['Antivirus may flag or quarantine it.', 'Attaching to another running program is the technique behavior-based detection looks for, so a warning is expected — it is about the technique, not a virus.'],
    ],
    risk: ['The risk is yours.', /to stop the companion entirely, quit it from its notification-area icon\.$/],
    parts: [/starts with Windows/, /keeps running after you close its window/, /notification area/, /right-click it to quit/, /asks Steam to start the game again/, /starts itself when you log in and brings your game back/],
  },
  {
    locale: 'pt-BR' as const,
    file: 'pt-BR.ts',
    heading: 'Continua rodando em segundo plano.',
    label: 'Reiniciar o Bomb Farm se ele fechar',
    tab: 'Ao vivo',
    unchanged: [
      ['Lê sua conta.', 'De duas formas: chamando o servidor do próprio jogo com o token de sessão que o jogo já salva no seu computador, e conectando-se ao cliente do jogo em execução para ler o tráfego que esse cliente já troca com esse servidor.'],
      ['Escreve só quando você manda.', 'Tudo o que ele mostra é leitura. As escritas que ele pode fazer são uma rolagem de forja, equipar ou desequipar um item, reembolsar e redistribuir os pontos de status de um herói, e queimar itens para obter Essência de Forja — pela aba Forja (inclusive a página Desconstruir), pela fila de forja e pelas etapas de Aplicar do Otimizador, só depois que você ligar "Deixar o app forjar, equipar e redistribuir pontos" nas Configurações, e só depois de confirmar cada execução. Nada mais nele pode alterar sua conta, o cliente do jogo ou seu progresso.'],
      ['Seu token não sai do lugar.', 'É enviado apenas para app.bombfarm.net — nunca para nós, nunca para terceiros, nunca para um log.'],
      ['O antivírus pode sinalizar ou colocar em quarentena.', 'Conectar-se a outro programa em execução é a técnica que a detecção por comportamento procura, então um aviso é esperado — ele é sobre a técnica, não sobre um vírus.'],
    ],
    risk: ['O risco é seu.', /para encerrar o companion por completo, saia pelo ícone na área de notificação\.$/],
    parts: [/inicia junto com o Windows/, /continua rodando depois que você fecha a janela/, /área de notificação/, /botão direito para sair/, /pede ao Steam para abrir o jogo de novo/, /se inicia quando você entra no Windows e traz seu jogo de volta/],
  },
])('CONSENT_TEXT[$locale] — background-running disclosure', ({ locale, file, heading, label, tab, unchanged, risk, parts }) => {
  const { body } = CONSENT_TEXT[locale];

  it('places the new clause directly after the token clause and leaves the other four clauses byte-identical', () => {
    expect(body.map((c) => c.heading).slice(0, 5)).toEqual([
      ...unchanged.slice(0, 3).map(([h]) => h),
      heading,
      unchanged[3]?.[0],
    ]);
    for (const [h, text] of unchanged) {
      expect(body.find((c) => c.heading === h)?.text).toBe(text);
    }
  });

  it('names the background run, the tray as the way to quit, and the relaunch compound', () => {
    const clause = body.find((c) => c.heading === heading);
    expect(clause).toBeDefined();
    for (const part of parts) expect(clause?.text).toMatch(part);
    expect(clause?.text).toContain(`"${label}"`);
    expect(clause?.text).toContain(tab);
  });

  it('quotes the restart switch label exactly as the renderer copy map spells it', () => {
    expect(copyMap(file)).toContain(`settingsRestartGameOnExitLabel: '${label}'`);
  });

  it('uses the Live tab name from the renderer copy map', () => {
    expect(copyMap(file)).toContain(`liveNavLabel: '${tab}'`);
  });

  it('closes the risk clause by naming the notification-area icon as the way to stop the app entirely', () => {
    const [riskHeading, riskEnding] = risk;
    if (!(riskEnding instanceof RegExp)) throw new Error('risk fixture must carry a RegExp ending');
    const clause = body.find((c) => c.heading === riskHeading);
    expect(clause?.text).toMatch(riskEnding);
  });
});

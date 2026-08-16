import { afterEach, describe, expect, it } from 'vitest';
import { STRINGS, sub, parseEmphasis } from '@/shared/i18n';
import {
  normalizeHero,
  normalizeAccount,
  shouldShowEmptyState,
  DEFAULT_TREE,
  DEFAULT_CONTEXT,
} from '@/shared/lib/storage';

describe('save-failure toast (MOD-45)', () => {
  it('toastSaveFailed is present in EN and PT', () => {
    expect(STRINGS.en.toastSaveFailed).toBe(
      'Could not save — browser storage is full or unavailable',
    );
    expect(STRINGS.pt.toastSaveFailed).toBe(
      'Não foi possível salvar — o armazenamento do navegador está cheio ou indisponível',
    );
  });
});

describe('account house chrome (AHK-11)', () => {
  it('defines House subsection chrome in EN and PT', () => {
    expect(STRINGS.en.panelHouse).toBe('House');
    expect(STRINGS.pt.panelHouse).toBe('Casa');
    expect(STRINGS.en.houseLevelLabel).toBe('House level');
    expect(STRINGS.pt.houseLevelLabel).toBe('Nível da casa');
    expect(STRINGS.en.houseLevelLabel).not.toMatch(/\bH\.lvl\b|\bNv casa\b/i);
    expect(STRINGS.pt.houseLevelLabel).not.toMatch(/\bNv casa\b/);
  });

  it('houseRestHint uses {minutes} + {seconds} placeholders in both langs', () => {
    expect(STRINGS.en.houseRestHint).toContain('{minutes}');
    expect(STRINGS.en.houseRestHint).toContain('{seconds}');
    expect(STRINGS.pt.houseRestHint).toContain('{minutes}');
    expect(STRINGS.pt.houseRestHint).toContain('{seconds}');
    expect(sub(STRINGS.en.houseRestHint, { minutes: 9, seconds: 22 })).toBe('Rest 9 min 22 s');
    expect(sub(STRINGS.pt.houseRestHint, { minutes: 9, seconds: 22 })).toBe('Descanso 9 min 22 s');
  });

  it('import preview chrome is distinct from the upload step', () => {
    expect(STRINGS.en.importPreviewTitle).not.toBe(STRINGS.en.importDialogTitle);
    expect(STRINGS.pt.importPreviewTitle).not.toBe(STRINGS.pt.importDialogTitle);
    expect(STRINGS.en.importPreviewDesc).not.toBe(STRINGS.en.importDialogDesc);
    expect(STRINGS.pt.importPreviewDesc).not.toBe(STRINGS.pt.importDialogDesc);
  });
});

describe('account form UX chrome (AFU-10/11)', () => {
  it('EN panelSheet reads Stats; PT reads Atributos', () => {
    expect(STRINGS.en.panelSheet).toBe('Stats');
    expect(STRINGS.pt.panelSheet).toBe('Atributos');
    expect(STRINGS.pt.panelSheet).not.toMatch(/\bStats\b/);
  });

  it('panelAccount title key present in EN and PT', () => {
    expect(STRINGS.en.panelAccount).toBe('Account');
    expect(STRINGS.pt.panelAccount).toBe('Conta');
  });
});

describe('planner tabs IA (PTI-*)', () => {
  const tabLabels = {
    tabHero: { en: 'Abilities', pt: 'Habilidades' },
    tabGear: { en: 'Gear', pt: 'Equipamento' },
    tabAccount: { en: 'Account', pt: 'Conta' },
    tabPoints: { en: 'Points', pt: 'Pontos' },
    // Farm Ranking (T1): renamed Phases -> Farm, identical in both languages.
    navPhases: { en: 'Farm', pt: 'Farm' },
    navPlanner: { en: 'Planner', pt: 'Planner' },
    tabHeroWarnTitle: { en: 'Abilities need attention', pt: 'Habilidades precisam de atenção' },
    tabGearWarnTitle: { en: 'Gear needs attention', pt: 'Equipamento precisa de atenção' },
  } as const;

  const panelTitles = {
    panelHero: { en: 'Hero', pt: 'Herói' },
    panelItems: { en: 'Items', pt: 'Itens' },
    panelCompare: { en: 'Gear compare', pt: 'Comparar equipamento' },
    panelSheet: { en: 'Stats', pt: 'Atributos' },
    panelAccount: { en: 'Account', pt: 'Conta' },
    panelPoints: { en: 'Points', pt: 'Pontos' },
    panelEffective: { en: 'Effective stats', pt: 'Stats efetivos' },
  } as const;

  it('tab labels have no numeric prefixes (PTI-03)', () => {
    for (const [key, expected] of Object.entries(tabLabels)) {
      expect(STRINGS.en[key as keyof typeof tabLabels]).toBe(expected.en);
      expect(STRINGS.pt[key as keyof typeof tabLabels]).toBe(expected.pt);
      expect(STRINGS.en[key as keyof typeof tabLabels]).not.toMatch(/^\d+ ·/);
      expect(STRINGS.pt[key as keyof typeof tabLabels]).not.toMatch(/^\d+ ·/);
    }
  });

  it('subsection panel titles drop numeric prefixes (PTI-03)', () => {
    for (const [key, expected] of Object.entries(panelTitles)) {
      expect(STRINGS.en[key as keyof typeof panelTitles]).toBe(expected.en);
      expect(STRINGS.pt[key as keyof typeof panelTitles]).toBe(expected.pt);
      expect(STRINGS.en[key as keyof typeof panelTitles]).not.toMatch(/^\d+ ·/);
      expect(STRINGS.pt[key as keyof typeof panelTitles]).not.toMatch(/^\d+ ·/);
    }
  });

  it('retire collapse-all chrome keys (PTI-07)', () => {
    expect('collapseAll' in STRINGS.en).toBe(false);
    expect('expandAll' in STRINGS.en).toBe(false);
    expect('collapseAll' in STRINGS.pt).toBe(false);
    expect('expandAll' in STRINGS.pt).toBe(false);
  });

  it('first tab label matches Abilities panel title (hero strip owns identity)', () => {
    expect(STRINGS.en.tabHero).toBe(STRINGS.en.panelAbilities);
    expect(STRINGS.pt.tabHero).toBe(STRINGS.pt.panelAbilities);
    expect(STRINGS.en.panelAbilities).toBe('Abilities');
    expect(STRINGS.pt.panelAbilities).toBe('Habilidades');
    expect(STRINGS.en.panelAbilities).not.toMatch(/^\d+ ·/);
    expect(STRINGS.pt.panelAbilities).not.toMatch(/^\d+ ·/);
  });

  it('hero identity chrome labels (name + rank)', () => {
    expect(STRINGS.en.heroNameLabel).toBe('Name');
    expect(STRINGS.en.heroRank).toBe('Rank');
    expect(STRINGS.pt.heroNameLabel).toBe('Nome');
    expect(STRINGS.pt.heroRank).toBe('Rank');
  });
});

describe('effective stats panel chrome (EST-*)', () => {
  it('effectiveTip clarifies post-pipeline sources in EN and PT (EST-04, EST-09)', () => {
    expect(STRINGS.en.effectiveTip).toBe(
      'Includes gear, points, skill tree, abilities, and team buffs.',
    );
    expect(STRINGS.pt.effectiveTip).toBe(
      'Inclui equipamento, pontos, árvore, habilidades e buffs de time.',
    );
  });

  it('defines fuse / rest / target HP chrome in EN and PT', () => {
    expect(STRINGS.en.effectiveFuse).toBe('Fuse');
    expect(STRINGS.en.effectiveRest).toBe('Rest');
    expect(STRINGS.en.effectiveTargetHp).toBe('Target HP');
    expect(STRINGS.pt.effectiveFuse).toBe('Pavio');
    expect(STRINGS.pt.effectiveRest).toBe('Descanso');
    expect(STRINGS.pt.effectiveTargetHp).toBe('HP do alvo');
  });

  it('defines breakdown derived labels, sources, notes, and formula keys (ESB-12)', () => {
    const keys = [
      'effectiveMitF',
      'effectiveDmg',
      'effectiveHit',
      'effectiveCriticalHit',
      'effectiveCritFactor',
      'effectiveBombsPerSec',
      'effectiveField',
      'effectiveUptime',
      'effectiveActiveDps',
      'effectiveSustainedDps',
      'bdSrcBase',
      'bdSrcLevel',
      'bdSrcStars',
      'bdSrcSheetAbilities',
      'bdSrcGear',
      'bdSrcPoints',
      'bdSrcTree',
      'bdSrcAbilities',
      'bdSrcTeam',
      'bdSrcAbilitiesTeam',
      'bdLedgerTotal',
      'bdNoteCapped',
      'bdNoteSplit',
      'bdNoteKeenEye',
      'bdNoteDiamondTip',
      'bdNoteBrutalStrike',
      'bdGroupSheet',
      'bdGroupDerived',
      'bdTriggerAria',
      'bdFormulaMitF',
      'bdFormulaDmg',
      'bdFormulaHit',
      'bdFormulaCriticalHit',
      'bdFormulaCritFactor',
      'bdFormulaFuse',
      'bdFormulaBombsSerial',
      'bdFormulaBombsWiki',
      'bdFormulaField',
      'bdFormulaRest',
      'bdFormulaUptime',
      'bdFormulaActive',
      'bdFormulaSustained',
      'bdTermMit',
      'bdTermPen',
      'bdTermTree',
      'bdTermAbl',
      'bdTermExtra',
      'bdTermAtk',
      'bdTermMitigation',
      'bdTermDamage',
      'bdTermCc',
      'bdTermCd',
      'bdTermCdr',
      'bdTermWalk',
      'bdTermSf',
      'bdTermDrain',
      'bdTermRestSeconds',
      'bdTermField',
      'bdTermRestSecs',
      'bdTermAvg',
      'bdTermRange',
      'bdTermActiveDps',
    ] as const;
    for (const lang of ['en', 'pt'] as const) {
      for (const k of keys) {
        const v = STRINGS[lang][k];
        expect(v, `${lang}.${k}`).toBeTruthy();
        expect(String(v).length).toBeGreaterThan(0);
      }
    }
    expect(STRINGS.en.bdTriggerAria).toContain('{stat}');
    expect(STRINGS.pt.bdTriggerAria).toContain('{stat}');
    expect(STRINGS.en.bdNoteSplit).toContain('{own}');
    expect(STRINGS.pt.bdNoteSplit).toContain('{team}');
  });

  it('explain-math guard: fuse / crit-factor tokens stay in explainSections (ESB-11)', () => {
    const enCodes = STRINGS.en.explainSections.map((s) => s.code).join('\n');
    const ptCodes = STRINGS.pt.explainSections.map((s) => s.code).join('\n');
    expect(enCodes).toMatch(/critChance|critDmg|cdr|bombs\/s|walk/i);
    expect(ptCodes).toMatch(/cdr|bombs|walk|pavio|fuse|crit/i);
    expect(STRINGS.en.bdFormulaFuse).toContain('0.4');
    expect(STRINGS.en.explainSections.some((s) => s.code?.includes('0.4'))).toBe(true);
  });
});

describe('quick guide (import-only workflow)', () => {
  const guideBodies = (lang: 'en' | 'pt') => STRINGS[lang].guideSteps.map((s) => s.d);

  it('has four sequentially numbered steps in EN and PT', () => {
    expect(STRINGS.en.guideSteps).toHaveLength(4);
    expect(STRINGS.pt.guideSteps).toHaveLength(4);
    expect(STRINGS.en.guideSteps.map((s) => s.t)).toEqual([
      '1 · Export',
      '2 · Import',
      '3 · Points',
      '4 · Compare & save',
    ]);
    expect(STRINGS.pt.guideSteps.map((s) => s.t)).toEqual([
      '1 · Exportar',
      '2 · Importar',
      '3 · Pontos',
      '4 · Comparar & salvar',
    ]);
  });

  it('omits manual-setup chrome and Infer naked references', () => {
    for (const lang of ['en', 'pt'] as const) {
      const joined = guideBodies(lang).join('\n');
      expect(joined).not.toMatch(/manual|Manual|manualmente|Configuração manual/i);
      expect(joined).not.toMatch(/Infer naked|Inferir base/i);
    }
    expect(STRINGS.en).not.toHaveProperty('guideTabManual');
    expect(STRINGS.en).not.toHaveProperty('guideImportSteps');
    expect(STRINGS.en).not.toHaveProperty('emptyManualCta');
  });

  it('guide bodies omit Context setup instructions', () => {
    for (const lang of ['en', 'pt'] as const) {
      for (const body of guideBodies(lang)) {
        expect(body).not.toMatch(/set <em>Context<\/em>|ajuste o <em>Contexto<\/em>/i);
        expect(body).not.toMatch(/\bContext panel\b|\bpainel Contexto\b/i);
      }
    }
  });

  it('points step references hero strip next point, not the top bar', () => {
    expect(STRINGS.en.guideSteps[2].d).toMatch(/<em>Next point<\/em>/);
    expect(STRINGS.en.guideSteps[2].d).toMatch(/hero strip/i);
    expect(STRINGS.en.guideSteps[2].d).not.toMatch(/top bar/i);
    expect(STRINGS.pt.guideSteps[2].d).toMatch(/<em>Próximo ponto<\/em>/);
    expect(STRINGS.pt.guideSteps[2].d).toMatch(/faixa do herói/i);
    expect(STRINGS.pt.guideSteps[2].d).not.toMatch(/barra superior/i);
  });

  it('compare step mentions Phases in the top bar', () => {
    expect(STRINGS.en.guideSteps[3].d).toMatch(/<em>Phases<\/em>/);
    expect(STRINGS.en.guideSteps[3].d).toMatch(/top bar/i);
    expect(STRINGS.pt.guideSteps[3].d).toMatch(/<em>Fases<\/em>/);
    expect(STRINGS.pt.guideSteps[3].d).toMatch(/barra superior/i);
  });
});

describe('explain-tab copy (advice-column IA alignment)', () => {
  const explainJoined = (lang: 'en' | 'pt') =>
    STRINGS[lang].explainSections.map((s) => `${s.h}\n${s.p.join('\n')}`).join('\n');

  it('does not refer to a Context / Contexto panel as shared chrome', () => {
    expect(explainJoined('en')).not.toMatch(/\bContext\b/);
    expect(explainJoined('pt')).not.toMatch(/\bContexto\b/);
  });

  it('points farm phase at Phases page and Account for House', () => {
    expect(STRINGS.en.explainSections[0].p[1]).toMatch(/Account shares House/);
    expect(STRINGS.en.explainSections[0].p[1]).toMatch(/Phases page/);
    expect(STRINGS.en.explainSections[0].p[1]).toMatch(/Effective stats/);
    expect(STRINGS.en.explainSections[0].p[1]).toMatch(/level power/);
    expect(STRINGS.pt.explainSections[0].p[1]).toMatch(/A Conta compartilha Casa/);
    expect(STRINGS.pt.explainSections[0].p[1]).toMatch(/Fases/);
    expect(STRINGS.pt.explainSections[0].p[1]).toMatch(/Stats efetivos/);
    expect(STRINGS.pt.explainSections[0].p[1]).toMatch(/poder de nível/);
  });

  it('explains synced farm phase and serial cycle knobs', () => {
    expect(STRINGS.en.explainSections[1].p[0]).toMatch(/synced farm phase/);
    expect(STRINGS.en.explainSections[2].p[0]).toMatch(/Walk delay/);
    expect(STRINGS.en.explainSections[2].p[1]).toMatch(/Blocks per bomb/);
    expect(STRINGS.en.explainSections[2].p[2]).toMatch(/Wiki bombs/);
    expect(STRINGS.pt.explainSections[1].p[0]).toMatch(/fase de farm sincronizada/);
    expect(STRINGS.pt.explainSections[2].p[0]).toMatch(/caminhada/i);
    expect(STRINGS.pt.explainSections[2].p[2]).toMatch(/Wiki/);
  });

  it('section 1 describes the read-only Stats table on Points using its actual column names (explain-math.md rule 2)', () => {
    // The Stats table moved from Gear to Points and became read-only (birth→Total telescoping
    // breakdown) — the explain copy must name the on-screen columns (gear.ts colSheet* labels)
    // and must not still tell the player to type the geared sheet or place Stats on Gear.
    expect(STRINGS.en.explainSections[0].p[2]).toMatch(/Points tab/);
    expect(STRINGS.en.explainSections[0].p[2]).toMatch(/read-only/);
    expect(STRINGS.en.explainSections[0].p[2]).toMatch(/Birth/);
    expect(STRINGS.en.explainSections[0].p[2]).toMatch(/Δ level/);
    expect(STRINGS.en.explainSections[0].p[2]).toMatch(/Δ stars/);
    expect(STRINGS.en.explainSections[0].p[2]).toMatch(/Δ ability/);
    expect(STRINGS.en.explainSections[0].p[2]).toMatch(/Δ gear/);
    expect(STRINGS.en.explainSections[0].p[2]).toMatch(/Δ points/);
    expect(STRINGS.en.explainSections[0].p[2]).toMatch(/Δ tree/);
    expect(STRINGS.en.explainSections[0].p[2]).toMatch(/Total/);
    expect(STRINGS.en.explainSections[0].p[2]).toMatch(/moved here from the Gear tab/);
    expect(STRINGS.en.explainSections[0].p[2]).not.toMatch(/type in Geared|type the geared sheet/i);

    expect(STRINGS.pt.explainSections[0].p[2]).toMatch(/aba Pontos/);
    expect(STRINGS.pt.explainSections[0].p[2]).toMatch(/Ao nascer/);
    expect(STRINGS.pt.explainSections[0].p[2]).toMatch(/Δ nível/);
    expect(STRINGS.pt.explainSections[0].p[2]).toMatch(/Δ estrela/);
    expect(STRINGS.pt.explainSections[0].p[2]).toMatch(/Δ habilidade/);
    expect(STRINGS.pt.explainSections[0].p[2]).toMatch(/Δ gear/);
    expect(STRINGS.pt.explainSections[0].p[2]).toMatch(/Δ pontos/);
    expect(STRINGS.pt.explainSections[0].p[2]).toMatch(/Δ árvore/);
    expect(STRINGS.pt.explainSections[0].p[2]).toMatch(/Total/);
    expect(STRINGS.pt.explainSections[0].p[2]).toMatch(/aba Equipamento/);

    // No explain/guide prose anywhere should still tell the player to type the geared sheet
    // or claim Stats lives on Gear.
    expect(explainJoined('en')).not.toMatch(/type (in|the) geared sheet/i);
    expect(explainJoined('pt')).not.toMatch(/digite a ficha equipada/i);
    for (const step of STRINGS.en.guideSteps) {
      expect(step.d).not.toMatch(/type (in|the) geared sheet/i);
    }
    for (const step of STRINGS.pt.guideSteps) {
      expect(step.d).not.toMatch(/digite a ficha equipada/i);
    }
  });

  it('drops Gates / Need% from props-and-phases section', () => {
    expect(STRINGS.en.explainSections[6].h).toBe('7 · Props and phases');
    expect(STRINGS.en.explainSections[6].p).toHaveLength(1);
    expect(STRINGS.en.explainSections[6].p.join(' ')).not.toMatch(/\bgate/i);
    expect(STRINGS.en.explainSections[6].p.join(' ')).not.toMatch(/Need%/);
    expect(STRINGS.pt.explainSections[6].h).toBe('7 · Alvos e fases');
    expect(STRINGS.pt.explainSections[6].p).toHaveLength(1);
    expect(STRINGS.pt.explainSections[6].p.join(' ')).not.toMatch(/portal/i);
    expect(STRINGS.pt.explainSections[6].p.join(' ')).not.toMatch(/Falta%/);
  });
});

describe('sub', () => {
  it('interpolates named placeholders', () => {
    expect(sub('a {x} {y}', { x: 1, y: 'z' })).toBe('a 1 z');
    expect(sub('missing {nope}', {})).toBe('missing ');
  });
});

describe('sheet ability copy (on-sheet names follow Lang)', () => {
  it('PT tips keep official Ponta / Olho names as on-sheet', () => {
    const t = STRINGS.pt;
    expect(t.abilitiesPicker).toBe('Seletor de habilidades');
    expect(t).not.toHaveProperty('penWarn');
    expect(t.abilitiesTip).toMatch(/Ponta de Diamante/);
    expect(t.abilitiesTip).toMatch(/Golpe Brutal/);
    expect(t.abilitiesTip).toMatch(/stats do herói no jogo/);
    // BSPW3-11/AC-22: the budget rule is min(level, slots x 20) — "slots x 10" is falsified.
    expect(t.abilitiesTip).toMatch(/slots da raridade × 20/);
    expect(t.abilitiesTip).not.toMatch(/× 10/);
    expect(t.sheetAbilityTag).toBe('Altera atributos');
    expect(t.sheetTip).toMatch(/Ponta de Diamante/);
    expect(t.sheetTip).toMatch(/save/i);
  });

  it('EN tips use English on-sheet ability names (no PT leakage)', () => {
    const t = STRINGS.en;
    expect(t.abilitiesPicker).toBe('Ability picker');
    expect(t.abilitiesTip).toMatch(/Diamond Tip/);
    expect(t.abilitiesTip).toMatch(/Keen Eye/);
    expect(t.abilitiesTip).toMatch(/Brutal Strike/);
    expect(t.abilitiesTip).toMatch(/in-game stats/);
    // BSPW3-11/AC-22: the budget rule is min(level, slots x 20) — "slots x 10" is falsified.
    expect(t.abilitiesTip).toMatch(/rarity slots × 20/);
    expect(t.abilitiesTip).not.toMatch(/× 10/);
    expect(t.sheetAbilityTag).toBe('Affects stats');
    expect(t.sheetTip).toMatch(/Diamond Tip/);
    expect(t.abilitiesTip).not.toMatch(/Ponta de Diamante|Olho Clínico/);
    expect(t.sheetTip).not.toMatch(/Ponta de Diamante|Olho Clínico/);
  });

  it('sheet tip describes birth-backed sheet from the save', () => {
    for (const lang of ['en', 'pt'] as const) {
      const t = STRINGS[lang];
      expect(t.sheetTip).toMatch(/save/i);
      expect(t.sheetTip).toMatch(/birth|nascer/i);
      expect(t.sheetTip).not.toMatch(/Infer naked|Inferir base|Use Infer/i);
      expect(t.sheetTip).not.toMatch(/only stat block you type|único bloco de stats que você digita/i);
    }
    expect(STRINGS.en).not.toHaveProperty('sheetTipLegacy');
    expect(STRINGS.en).not.toHaveProperty('sheetTipManual');
    expect(STRINGS.en).not.toHaveProperty('inferNakedFromSheet');
  });
});

describe('parseEmphasis', () => {
  it('splits plain text and <em> markers', () => {
    expect(parseEmphasis('Hit <em>Import</em> then go.')).toEqual([
      { kind: 'text', value: 'Hit ' },
      { kind: 'em', value: 'Import' },
      { kind: 'text', value: ' then go.' },
    ]);
  });

  it('returns a single text part when there is no markup', () => {
    expect(parseEmphasis('No markers here.')).toEqual([
      { kind: 'text', value: 'No markers here.' },
    ]);
  });
});

describe('PT template contracts after copy polish (PTUX-03)', () => {
  it('sub interpolates touched PT strings with unchanged placeholder names', () => {
    expect(sub(STRINGS.pt.abilitiesSpent, { spent: 3, max: 50 })).toBe('3 / 50 pontos');
    expect(sub(STRINGS.pt.setupNeedUnspentPts, { left: 12, max: 40 })).toBe(
      'Gaste os pontos restantes (12 de 40)',
    );
    expect(sub(STRINGS.pt.setupNeedUnspentAbilities, { left: 5, max: 30 })).toBe(
      'Gaste os pontos de habilidade restantes (5 de 30)',
    );
  });

  it('EN unspent point templates interpolate left/max', () => {
    expect(sub(STRINGS.en.setupNeedUnspentPts, { left: 12, max: 40 })).toBe(
      'Spend remaining points (12 left of 40)',
    );
    expect(sub(STRINGS.en.setupNeedUnspentAbilities, { left: 5, max: 30 })).toBe(
      'Spend remaining ability points (5 left of 30)',
    );
  });

  it('parseEmphasis keeps balanced <em> on the PT guide Points step', () => {
    const step = STRINGS.pt.guideSteps[2].d;
    expect(step).toContain('<em>Próximo ponto</em>');
    expect(step).toContain('<em>Pontos</em>');
    expect(parseEmphasis(step)).toEqual([
      {
        kind: 'text',
        value:
          'O app já calcula sozinho o seu próximo melhor ponto — veja ',
      },
      { kind: 'em', value: 'Próximo ponto' },
      {
        kind: 'text',
        value: ' na faixa do herói acima das abas. Aumente esse mesmo atributo no painel ',
      },
      { kind: 'em', value: 'Pontos' },
      {
        kind: 'text',
        value: ' para ver o DPS subir e, no jogo, gaste o ponto de verdade para acompanhar.',
      },
    ]);
  });

  it('balances every <em> pair across PT guide copy', () => {
    const guideCopy = STRINGS.pt.guideSteps.map((s) => s.d);
    for (const text of guideCopy) {
      const opens = (text.match(/<em>/g) ?? []).length;
      const closes = (text.match(/<\/em>/g) ?? []).length;
      expect(opens).toBe(closes);
      // No leftover raw tags after parse
      const rebuilt = parseEmphasis(text)
        .map((p) => (p.kind === 'em' ? `<em>${p.value}</em>` : p.value))
        .join('');
      expect(rebuilt).toBe(text);
    }
  });
});

/** Flatten all string values under STRINGS.pt (nested objects + guide/explain arrays). */
function collectPtStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') {
    out.push(value);
    return out;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectPtStrings(item, out);
    return out;
  }
  if (value && typeof value === 'object') {
    for (const v of Object.values(value as Record<string, unknown>)) {
      collectPtStrings(v, out);
    }
  }
  return out;
}

describe('portuguese UX glossary (PTUX)', () => {
  const ptValues = collectPtStrings(STRINGS.pt);
  const joined = ptValues.join('\n');

  it('clears glossary seed smells from PT chrome values', () => {
    // Seed calques / bare EN — must not appear as chrome wording.
    expect(joined).not.toMatch(/\bUptime\b/);
    expect(joined).not.toMatch(/\bRecopiar\b/);
    expect(joined).not.toMatch(/Andar s/);
    expect(joined).not.toMatch(/Mult\. faltante/);
    expect(joined).not.toMatch(/\bflat\b/i);
    // Combat-hit labels: topbar, tables/compare, and Math check use EN Hit(s).
    expect(STRINGS.pt.metricHit).toBe('Hit');
    expect(STRINGS.pt.metricSustained).toBe('DPS efetivo');
    expect(STRINGS.pt.metricActive).toBe('DPS Ativo');
    expect(STRINGS.pt.colHits).toBe('Hits');
    expect(STRINGS.pt.compareHit).toBe('Hit');
    expect(STRINGS.pt.metricUptime).toBe('Tempo ativo');
    expect(STRINGS.pt.walkS).toBe('Caminhada (s)');
    expect(STRINGS.pt.reCopy).toBe('Copiar novamente');
    expect(STRINGS.pt.factMissing).toBe('Multiplicador que falta');
    expect(STRINGS.pt.cycleSerial).toBe('Em série');
    expect(STRINGS.pt.statShort.cdr).toBe('Redução de recarga (%)');
    expect(STRINGS.pt.statFull.cdr).toBe('Redução de recarga');
    expect(STRINGS.pt.slotStatFullLabels.cooldown).toBe('Redução de recarga');
    // No bare CDR / Cooldown leftovers in PT chrome labels.
    expect(STRINGS.pt.slotStatLabels.cooldown).not.toMatch(/CDR|Cooldown/i);
    expect(STRINGS.pt.statShort.cdr).not.toMatch(/CDR|Cooldown/i);
    expect(STRINGS.pt.statFull.cdr).not.toMatch(/CDR|Cooldown/i);
  });

  it('keeps official ability names in PT chrome', () => {
    expect(joined).toMatch(/Olho Clínico/);
    expect(joined).toMatch(/Ponta de Diamante/);
    expect(joined).toMatch(/Grito de Guerra/);
    // Guide + explain surfaces (PTUX-08)
    expect(STRINGS.pt.sheetTip).toMatch(/Olho Clínico/);
    expect(STRINGS.pt.sheetTip).toMatch(/Ponta de Diamante/);
    expect(STRINGS.pt.explainSections[7].p.join(' ')).toMatch(/Grito de Guerra/);
  });

  it('does not bleed PT glossary wording into EN chrome keys touched only for PT', () => {
    expect(STRINGS.en.metricUptime).toBe('Uptime');
    expect(STRINGS.en.metricHit).toBe('Hit');
    expect(STRINGS.en.metricSustained).toBe('Sustained DPS');
    expect(STRINGS.en.metricActive).toBe('Active DPS');
    expect(STRINGS.en.cycleSerial).toBe('Serial');
    expect(STRINGS.en.walkS).toBe('Walk s');
    expect(STRINGS.en.reCopy).toBe('Re-copy');
    expect(STRINGS.en.factMissing).toBe('Missing multiplier');
    expect(STRINGS.en.colHits).toBe('Hits');
    expect(STRINGS.en.statShort.cdr).toBe('CDR %');
    expect(STRINGS.en.off).toBe('off');
    expect(STRINGS.en.gateTimer).toBe('Timer');
    expect(STRINGS.en.compareHit).toBe('Hit');
    // No PT glossary phrasing accidentally copied into EN values
    const enJoined = collectPtStrings(STRINGS.en).join('\n');
    expect(enJoined).not.toMatch(/Tempo ativo/);
    expect(enJoined).not.toMatch(/Copiar novamente/);
    expect(enJoined).not.toMatch(/Caminhada \(s\)/);
    expect(enJoined).not.toMatch(/Multiplicador que falta/);
    expect(enJoined).not.toMatch(/Em série/);
    expect(enJoined).not.toMatch(/Redução de recarga/);
  });

  it('reuses glossary terms consistently across PT chrome surfaces', () => {
    // Uptime concept
    expect(STRINGS.pt.metricUptime).toBe('Tempo ativo');
    expect(STRINGS.pt.explainSections[4].h).toMatch(/tempo ativo/i);
    // Topbar DPS + Hit(s) labels; Math check observe also uses Hit
    expect(STRINGS.pt.metricHit).toBe('Hit');
    expect(STRINGS.pt.metricSustained).toBe('DPS efetivo');
    expect(STRINGS.pt.metricActive).toBe('DPS Ativo');
    expect(STRINGS.pt.colHits).toBe('Hits');
    expect(STRINGS.pt.compareHit).toBe('Hit');
    expect(STRINGS.pt.factPred).toBe('Previsto / critical hit');
    // Walk / copy / missing mult / serial / CDR family
    expect(STRINGS.pt.walkS).toBe('Caminhada (s)');
    expect(STRINGS.pt.reCopy).toBe('Copiar novamente');
    expect(STRINGS.pt.factMissing).toBe('Multiplicador que falta');
    expect(STRINGS.pt.cycleSerial).toBe('Em série');
    expect(STRINGS.pt.explainSections[2].p[0]).toMatch(/Modelo em série/);
    expect(STRINGS.pt.statShort.cdr).toBe('Redução de recarga (%)');
    expect(STRINGS.pt.statFull.cdr).toBe('Redução de recarga');
    expect(STRINGS.pt.slotStatFullLabels.cooldown).toBe('Redução de recarga');
    expect(STRINGS.pt.slotStatLabels.cooldown).toBe('Recarga');
    // Seed calques must stay gone (allowlist = Accepted EN leftovers only)
    const banned = [
      /\bUptime\b/,
      /\bRecopiar\b/,
      /Andar s/,
      /Mult\. faltante/,
      /\bflat\b/i,
      /\bSerial\b/,
      /\bCDR\b/,
      /Cooldown/,
      /\buptime\b/,
    ];
    for (const re of banned) {
      expect(joined).not.toMatch(re);
    }
    // Exact Hit / Hits chrome keys (compare + effective derived + …)
    expect(ptValues.filter((s) => s === 'Hit')).toEqual(['Hit', 'Hit', 'Hit']);
    expect(ptValues.filter((s) => s === 'Hits')).toEqual(['Hits']);
  });
});

describe('normalizeHero', () => {
  it('fills defaults for partial saves', () => {
    const h = normalizeHero({ id: 'abc', name: 'Test' });
    expect(h.rarity).toBe('Raro');
    expect(h.level).toBe(1);
    expect(h.loadout).toBeTruthy();
    expect(h.pts.attack).toBe(0);
  });
});

describe('normalizeAccount', () => {
  afterEach(() => {
    // no-op — pure normalize has no side effects
  });

  it('merges tree / context defaults', () => {
    const a = normalizeAccount({
      tree: { ...DEFAULT_TREE(), danoTotal: 1.25 },
      teamBuffs: { grito_guerra: 20 },
    });
    expect(a.tree.danoTotal).toBe(1.25);
    expect(a.teamBuffs.grito_guerra).toBe(20);
    expect(a.context.phase).toBe(DEFAULT_CONTEXT().phase);
  });
});

describe('DEFAULT_CONTEXT', () => {
  it('starts a fresh account with no farm phase and Stone as target prop', () => {
    const ctx = DEFAULT_CONTEXT();
    expect(ctx.phase).toBeNull();
    expect(ctx.houseIdx).toBe(0);
    expect(ctx.houseLevel).toBe(0);
    expect(ctx.targetProp).toBe('stone');
    expect(ctx).not.toHaveProperty('blastRange');
  });
});

describe('shouldShowEmptyState', () => {
  it('shows the empty state when no heroes exist', () => {
    expect(shouldShowEmptyState(0)).toBe(true);
  });

  it('hides the empty state as soon as any hero exists', () => {
    expect(shouldShowEmptyState(1)).toBe(false);
    expect(shouldShowEmptyState(3)).toBe(false);
  });
});

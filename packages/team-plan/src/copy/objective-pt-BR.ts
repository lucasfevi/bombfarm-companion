import type { TeamPlanObjectivePairsCopy } from './index';

export const teamPlanObjectivePairsPtBR: TeamPlanObjectivePairsCopy = {
  teamPlanPhaseHintNoneDps:
    'Nenhuma fase fixada. O dano é pontuado na fase em que sua conta está agora.',
  teamPlanPhaseHintNoneFarm:
    'Nenhuma fase fixada. A busca escolhe a melhor fase que seu esquadrão aguenta, e diz qual ficou.',
  teamPlanLuckFrozenDps:
    'Pontos já em Sorte ficam onde estão — esta busca nunca mexe em Sorte, em nenhuma direção.',
  teamPlanLuckFrozenFarm:
    'Pontos já em Sorte ficam onde estão — esta busca nunca mexe em Sorte, em nenhuma direção, mesmo que Sorte aumente as chances de drop e portanto o ouro por hora.',
  teamPlanHeroDeltaNoteDps:
    'Os totais de antes/depois acima são de combate efetivo — as auras de time estão aplicadas e não são limitadas aos tetos de exibição do jogo (100% de chance de crítico, 80% de redução de recarga); isso é proposital, pois essa visão sem teto e com auras é o que a busca realmente otimiza. Abaixo, Ficha do herói espelha o que o próprio painel do jogo mostra (com teto); Stats de combate mantém a mesma visão sem teto.',
  teamPlanHeroDeltaNoteFarm:
    'Estes números por herói são DPS, não ouro por hora — esta busca pontuou o ganho do esquadrão, que é uma taxa que toda a rotação produz e não se divide por herói, então eles não vão somar o total acima. São de combate efetivo: as auras de time estão aplicadas e não são limitadas aos tetos de exibição do jogo (100% de chance de crítico, 80% de redução de recarga). Abaixo, Ficha do herói espelha o que o próprio painel do jogo mostra (com teto); Stats de combate mantém a mesma visão sem teto.',
  teamPlanObjectiveLabel: 'Pontuar por',
  teamPlanObjectiveAria: 'O que esta busca usa para pontuar um roster',
  teamPlanObjectiveOptionDamage: 'DPS',
  teamPlanObjectiveOptionGold: 'Ouro / h',
  teamPlanObjectiveHintDps:
    'Classifica builds pelo DPS de roster combinado. O ouro por hora não é pontuado, e pode cair.',
  teamPlanObjectiveHintFarm:
    'Classifica builds pelo ouro por hora que o esquadrão rende na fase ao lado. Um roster que rende mais pode bater mais fraco.',
  teamPlanSetupSectionBodyDps:
    'Monta um plano para os heróis marcados como Otimizar, com as mudanças que você permitir abaixo — pontuado pelo DPS de roster combinado.',
  teamPlanSetupSectionBodyFarm:
    'Monta um plano para os heróis marcados como Otimizar, com as mudanças que você permitir abaixo — pontuado pelo ouro por hora que o esquadrão rende.',
  teamPlanRunSummaryRegimeHintSaturatedDps:
    'Há mais demanda de campo do que slots de batalha — o DPS do roster é dividido entre quem pode lutar ao mesmo tempo.',
  teamPlanRunSummaryRegimeHintSaturatedFarm:
    'Há mais demanda de campo do que slots de batalha — o ganho por hora do esquadrão é dividido entre quem pode lutar ao mesmo tempo.',
  teamPlanTotalGainValueDps: '{delta} dps ({pct}%)',
  teamPlanTotalGainValueFarm: '{delta} ouro/h ({pct}%)',
  teamPlanResultsHeaderDps: 'Melhor DPS de roster encontrado por esta busca',
  teamPlanResultsHeaderFarm: 'Melhor ouro por hora encontrado por esta busca',
  teamPlanGearDipNoteDps:
    'Temporariamente atrás em {delta} dps — o passo Resetar pontos leva além de hoje.',
  teamPlanGearDipNoteFarm:
    'Temporariamente atrás em {delta} ouro/h — o passo Resetar pontos leva além de hoje.',
  teamPlanSaturationCalloutDps:
    'Seu campo está lotado (carga de batalha {duty} vs {slots} slots). O DPS do roster é dividido entre quem pode lutar ao mesmo tempo — só orientação; esta página não banca nem doa heróis por você.',
  teamPlanSaturationCalloutFarm:
    'Seu campo está lotado (carga de batalha {duty} vs {slots} slots). O ganho por hora do esquadrão é dividido entre quem pode lutar ao mesmo tempo — só orientação; esta página não banca nem doa heróis por você.',
  teamPlanForgeSkippedNoteDps:
    'A forja até o seu mínimo ficou de fora deste plano — ela não melhorou o DPS do roster.',
  teamPlanForgeSkippedNoteFarm:
    'A forja até o seu mínimo ficou de fora deste plano — ela não melhorou o ouro por hora do esquadrão.',
};

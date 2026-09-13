import type { TeamPlanObjectivePairsCopy } from './index';

export const teamPlanObjectivePairsPtBR: TeamPlanObjectivePairsCopy = {
  teamPlanPhaseHintNoneDps:
    'Nenhuma fase fixada. O dano é pontuado na fase em que sua conta está agora.',
  teamPlanPhaseHintNoneFarm:
    'Nenhuma fase fixada. A busca escolhe a melhor fase que seu esquadrão aguenta, e diz qual ficou.',
  teamPlanHeroDeltaNoteDps:
    'Estes números por herói são DPS de combate efetivo, com as auras de time aplicadas. Abaixo, Ficha do herói espelha o que o próprio painel do jogo mostra; Stats de combate é a visão que a busca pontuou.',
  teamPlanHeroDeltaNoteFarm:
    'Estes números por herói são DPS, não ouro por hora — esta busca pontuou o ganho do esquadrão, que é uma taxa que toda a rotação produz e não se divide por herói, então eles não vão somar o total acima. As auras de time estão aplicadas. Abaixo, Ficha do herói espelha o que o próprio painel do jogo mostra; Stats de combate é a visão que a busca pontuou.',
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
};

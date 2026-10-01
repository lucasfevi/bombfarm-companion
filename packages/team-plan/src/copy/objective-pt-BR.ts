import type { TeamPlanObjectivePairsCopy } from './index';

export const teamPlanObjectivePairsPtBR: TeamPlanObjectivePairsCopy = {
  teamPlanPhaseHintNoneDps:
    'Nenhuma fase fixada. O dano é pontuado na fase em que sua conta está agora.',
  teamPlanPhaseHintNoneFarm:
    'Nenhuma fase fixada. A busca escolhe a melhor fase que seu esquadrão aguenta, e diz qual ficou.',
  teamPlanPhaseHintNoneSetFarm:
    'O conjunto decide as fases: a busca escolhe a melhor fase onde ele cai que seu esquadrão limpa em {secs} s ou menos.',
  teamPlanScoredPhaseGate: 'O portão que você escolheu, pontuado dentro do tempo dele.',
  teamPlanScoredPhasePvp: 'A fase em que a sala do duelo está endurecida.',
  teamPlanObjectiveLabel: 'Pontuar por',
  teamPlanObjectiveAria: 'O que esta busca usa para pontuar um roster',
  teamPlanObjectiveOptionGold: 'Ouro / h',
  teamPlanObjectiveOptionGate: 'Passar o portão',
  teamPlanObjectiveOptionPvp: 'PVP',
  teamPlanObjectiveOptionSet: 'Farmar conjunto',
  teamPlanObjectiveHintDps:
    'Classifica builds pelo DPS de roster combinado. O ouro por hora não é pontuado, e pode cair.',
  teamPlanObjectiveHintFarm:
    'Classifica builds pelo ouro por hora que o esquadrão rende na fase ao lado. Um roster que rende mais pode bater mais fraco.',
  teamPlanObjectiveHintSetFarm:
    'Busca só nas fases onde o conjunto escolhido cai, e classifica builds por quantos baús de item desse conjunto caem por hora. Sorte vale pontos aqui, porque multiplica cada sorteio de baú; uma fase que o esquadrão não limpa em {secs} s ou menos não conta. A raridade não pode ser escolhida — a Sorte muda quantos baús caem, não a raridade que sai.',
  teamPlanObjectiveHintGate:
    'Classifica builds pelo dano que o esquadrão causa dentro do tempo do portão. Energia só conta pelo tempo em campo que compra antes de o tempo acabar; o ouro por hora não é pontuado.',
  teamPlanObjectiveHintPvp:
    'Classifica builds pelo dano que o esquadrão que você coloca em campo causa no duelo de um minuto — até tantos heróis quantas vagas o seu esquadrão tem, escolhidos no quadro de escopo. Quem aguenta o minuto inteiro não precisa de mais energia; o ouro por hora não é pontuado.',
  teamPlanSetupSectionBodyDps:
    'Monta um plano para os heróis marcados como Otimizar, com as mudanças que você permitir abaixo — pontuado pelo DPS de roster combinado.',
  teamPlanSetupSectionBodyFarm:
    'Monta um plano para os heróis marcados como Otimizar, com as mudanças que você permitir abaixo — pontuado pelo ouro por hora que o esquadrão rende.',
  teamPlanSetupSectionBodySetFarm:
    'Monta um plano para os heróis marcados como Otimizar, com as mudanças que você permitir abaixo — pontuado pelos baús de item do conjunto escolhido que caem por hora.',
  teamPlanSetupSectionBodyGate:
    'Monta um plano para os heróis marcados como Otimizar, com as mudanças que você permitir abaixo — pontuado pelo dano que causam dentro do tempo do portão.',
  teamPlanSetupSectionBodyPvp:
    'Monta um plano para o esquadrão de duelo que você coloca em campo no quadro de escopo — até tantos heróis quantas vagas o seu esquadrão tem, Otimizar e Deixar quieto igualmente — com as mudanças que você permitir abaixo, pontuado pelo dano que causa no duelo de um minuto. Doadores ficam fora da sala.',
  teamPlanTotalGainValueDps: '{delta} dps ({pct}%)',
  teamPlanTotalGainValueFarm: '{delta} ouro/h ({pct}%)',
  teamPlanTotalGainValueSetFarm: '{delta} baús do conjunto/h ({pct}%)',
  teamPlanTotalGainValueGate: '{delta} dps no portão ({pct}%)',
  teamPlanTotalGainValuePvp: '{delta} dps no duelo ({pct}%)',
  teamPlanGearDipNoteDps:
    'Temporariamente atrás em {delta} dps — o passo Resetar pontos leva além de hoje.',
  teamPlanGearDipNoteFarm:
    'Temporariamente atrás em {delta} ouro/h — o passo Resetar pontos leva além de hoje.',
  teamPlanGearDipNoteSetFarm:
    'Temporariamente atrás em {delta} baús do conjunto/h — o passo Resetar pontos leva além de hoje.',
  teamPlanGearDipNoteGate:
    'Temporariamente atrás em {delta} dps no portão — o passo Resetar pontos leva além de hoje.',
  teamPlanGearDipNotePvp:
    'Temporariamente atrás em {delta} dps no duelo — o passo Resetar pontos leva além de hoje.',
  teamPlanFarmSetLabel: 'Conjunto a farmar',
  teamPlanFarmSetAria: 'Qual conjunto de equipamento esta busca farma',
  teamPlanFarmSetPlaceholder: 'Escolha um conjunto',
  teamPlanFarmSetOption: '{set} · fases {min}–{max}',
  teamPlanFarmSetOptionLocked: '{set} · fases {min}–{max} · ainda não alcançado',
  teamPlanFarmSetHint: 'Só as fases onde este conjunto cai entram na busca, cada uma limpa em {secs} s ou menos.',
  teamPlanFarmSetNeeded: 'Escolha um conjunto a farmar antes de montar este plano.',
  teamPlanFarmSetNeedsMaxPhase:
    'Farmar um conjunto exige a fase mais distante que sua conta alcançou, que ainda não é conhecida.',
  teamPlanScoredPhaseSetSearched: 'Escolhida automaticamente — a melhor fase onde este conjunto cai que o esquadrão limpa em {secs} s ou menos.',
  teamPlanScoredPhaseSetTooSlow: 'Nenhuma fase onde este conjunto cai é limpa em {secs} s ou menos com este esquadrão.',
  teamPlanGatePhaseLabel: 'Portão a passar',
  teamPlanGatePhaseAria: 'Para qual portão esta busca planeja',
  teamPlanGatePhaseHint: 'Pontuado dentro dos {secs} s de tempo de portão deste ato, com o esquadrão entrando inteiro na abertura.',
  teamPlanGatePhaseSearchPlaceholder: 'Difícil, Normal 2-5, ou 150',
  teamPlanPvpSquadLabel: 'Duelo',
  teamPlanPvpSquadValue: '{count} de {max} em campo · {phase} · {secs} s',
  teamPlanPvpSquadHint: 'Quantos heróis o quadro de escopo coloca em campo contra as vagas do seu esquadrão, e a fase em que a sala está endurecida, como lido por último. Até o jogo informar suas vagas, o plano supõe as nove da casa de esquadrão mais alta.',
  teamPlanPvpRoomUnknown: 'fase da sala desconhecida',
  teamPlanPvpSquadTooMany: 'Seu esquadrão tem {max} vagas. Mova mais {excess} para Doar antes de montar este plano.',
};

/**
 * The Portuguese (Brazil) translation of `en.ts`. `HeroCopy` is a value-widening mapped type
 * (`export type HeroCopy = { readonly [K in keyof typeof heroEn]: string }` — `index.ts`), so this
 * file is annotated `: HeroCopy`, never `as HeroCopy`/`satisfies HeroCopy`/an index signature: the
 * annotation is what makes a missing key here a compile error naming the key (`TS2741`) and a
 * typo'd extra key a compile error too (`TS2353`) — both directions of the same guarantee.
 *
 * Key set and every `{placeholder}` must match `en.ts` exactly — `parity.test.ts` proves both at
 * runtime as a second, independent line of defence.
 */
import type { HeroCopy } from './index';

export const heroPtBR: HeroCopy = {
  heroDetailIdentityTitle: "Identidade",
  heroDetailIdentityRarity: "Raridade",
  heroDetailIdentityGrade: "Nota",
  heroDetailIdentityLevel: "Nível",
  heroDetailIdentityStars: "Estrelas",
  heroDetailIdentityDeployed: "Em campo",
  heroDetailIdentityNotDeployed: "Fora de campo",
  heroDetailIdentityAllowed: "Liberado",
  heroDetailIdentityNotAllowed: "Bloqueado",
  heroDetailIdentityMarketable: "Negociável",
  heroDetailIdentityNotMarketable: "Não negociável",

  heroDetailRollTitle: "Sorteio de nascimento",
  heroDetailRollQuality: "Qualidade do sorteio",
  heroDetailRollColStat: "Atributo",
  heroDetailRollColBand: "Faixa",
  heroDetailRollColPosition: "Posição",
  heroDetailRollValue: "Sorteado",
  heroDetailRollBand: "Sorteado dentro de {range}",
  heroDetailRollPercentile: "{pct}% dentro da faixa",
  heroDetailRollGradePlacement: "Onde ele fica na nota {letter}",
  heroDetailRollToNextLetter: "A {range} pontos da nota {letter}",
  heroDetailRollTopGrade: "Esta é a nota mais alta; não existe nada acima dela.",
  heroDetailRollNearEdge: "Este herói está perto da borda da sua nota.",
  heroDetailRollPermanent:
    "O sorteio de nascimento é permanente: nunca muda com nível, estrelas, equipamento ou pontos gastos.",
  heroDetailRollNoBirthRoll:
    "Este herói não tem sorteio de nascimento, então não há o que posicionar.",
  heroDetailRollNoBounds:
    "Este herói não tem os limites do sorteio, então não dá para medir a posição dentro deles.",
  heroDetailRollComputedDisagrees:
    "A qualidade que calculamos cai em uma letra diferente da que o jogo guardou.",
  heroDetailRollStoredLetterStands: "A letra guardada é a resposta do jogo e continua valendo.",
  heroDetailRollStoredLetter: "Nota guardada",
  heroDetailRollComputedLetter: "Nossa estimativa",
  heroDetailRollPlacementUncertain: "Leia a posição abaixo como incerta.",
  heroDetailRollTintIsOurs:
    "A cor da barra é um auxílio de leitura nosso, não uma regra publicada pelo jogo.",

  heroDetailAbilitiesTitle: "Habilidades",
  heroDetailAbilitiesLevelOfMax: "{level} de {max}",
  heroDetailAbilitiesEffect: "Efeito modelado",
  heroDetailAbilitiesOnSheetTag: "Na ficha",
  heroDetailAbilitiesNotModelled:
    "O modelo não tem efeito para esta habilidade, então não dá para calcular quanto ela vale.",
  heroDetailAbilitiesMaxed: "Já está no nível máximo; não existe próximo nível para comprar.",
  heroDetailAbilitiesNextLevelGain: "Mais um nível vale {pct}% para este herói",
  heroDetailAbilitiesAuraAtCeiling:
    "Seu time já está no teto desta aura em campo, então o próximo nível não compra nada.",
  heroDetailAbilitiesNotMeasured:
    "O modelo tem este efeito, mas ele cai fora do que o DPS sustentado consegue medir.",
  heroDetailAbilitiesNoBirthRoll:
    "Sem o sorteio de nascimento não dá para avaliar este herói, então nenhuma habilidade dele tem preço.",
  heroDetailAbilitiesSlots: "Espaços",
  heroDetailAbilitiesSlotsValue: "{used} de {max} para esta raridade",
  heroDetailAbilitiesPoints: "Pontos de habilidade",
  heroDetailAbilitiesPointsValue: "{spent} de {budget} gastos",
  heroDetailAbilitiesDeadPoints: "Pontos mortos",
  heroDetailAbilitiesDeadPointsHint:
    "O nível deste herói passou do que ele consegue gastar, então {count} pontos nunca poderão ser usados.",
  heroDetailAbilitiesDeadPointsNone:
    "Cada nível que este herói ganha ainda vira um ponto que ele pode gastar.",
  heroDetailAbilitiesDeadPointsAtCeiling:
    "Este herói tem exatamente os pontos que os espaços dele aguentam; os próximos níveis não somam nada.",
  heroDetailAbilitiesNone: "Este herói não tem nenhuma habilidade.",

  heroDetailCombatTitle: "Combate",
  heroDetailCombatNormalHit: "Hit normal",
  heroDetailCombatCritHit: "Hit crítico",
  heroDetailCombatAvgHit: "Hit médio",
  heroDetailCombatFieldTime: "Tempo em campo",
  heroDetailCombatFuseTime: "Tempo de pavio",
  heroDetailCombatUptime: "Tempo ativo",
  heroDetailCombatDps: "DPS",
  heroDetailCombatActiveDps: "DPS ativo",
  heroDetailCombatSustainedDps: "DPS sustentado",
  heroDetailCombatPenetration: "Penetração vs mitigação",
  heroDetailCombatDamageThrough: "Dano que passa",
  heroDetailCombatHitsToKill: "Hits para matar",
  heroDetailCombatProps: "Props",
  heroDetailCombatPhase: "Fase {name}",
  heroDetailCombatPhaseFromFarm: "Esta é a fase em que a sua tela de Farm está.",
  heroDetailCombatPhaseOverridden:
    "Você está vendo uma fase diferente da que está na sua tela de Farm.",
  heroDetailCombatFuseFloor: "Piso do pavio",
  heroDetailCombatFuseFloorHint: "O tempo de pavio não pode cair abaixo de {secs}s.",
  heroDetailCombatCdrCeiling: "Teto de redução de recarga",
  heroDetailCombatCdrCeilingReached: "Mais redução de recarga não compra nada.",
  heroDetailCombatNoProps: "Não há props nesta fase.",

  heroDetailSheetTitle: "Ficha de atributos",
  heroDetailPointsTitle: "Pontos gastos",
  heroDetailBreakdownTitle: "Detalhe por atributo",
  heroDetailGearTitle: "Conjunto equipado",
  heroDetailGearSlotContribution: "Contribuição por espaço",
  heroDetailGearTotals: "Totais do equipamento",
  heroDetailGearCompareTitle: "Comparação de conjuntos",
  heroDetailNextStatTitle: "Próximo atributo recomendado",
  heroDetailNextStatModeDamage: "Dano",
  heroDetailNextStatModeFarming: "Farm",
  heroDetailNextStatFarmUnavailable: "A recomendação de farm não está disponível aqui: {reason}",

  heroDetailEmptyNoAccount: "O jogo não está aberto, ou a conta ainda não foi lida.",
  heroDetailEmptyNoHeroes: "Esta conta não tem nenhum herói.",
};

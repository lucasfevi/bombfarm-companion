import type { TeamPlanGearFlowCopy } from './index';

export const teamPlanGearFlowPtBR: TeamPlanGearFlowCopy = {
  teamPlanFlowLocationInventory: 'Inventário',
  teamPlanFlowRowFromLabel: 'De',
  teamPlanFlowRowExisting: 'Item atual — sem mudança',
  teamPlanFlowRemovedHeading: 'Tirado deste herói',
  teamPlanFlowRowRemovedToInventory: 'Volta para o inventário',
  teamPlanFlowRemovedWhyCrowded:
    'O campo está cheio, então este herói esperando na Casa rende mais para o time do que usando este item. Ative "Manter todos equipados" para planejar sem isso.',
  teamPlanFlowRemovedWhyOther:
    'Nenhum outro herói no escopo consegue usá-lo, então ele fica no inventário.',
  teamPlanFlowRowForge: 'Forjar de +{from} para +{to}',
  teamPlanFlowSlotEmpty: 'Nenhum item proposto',
  teamPlanForgeQueueHeading: 'Fila de forja',
  teamPlanForgeQueueLadderAria: 'Escada de forja de {item}: +{from} a +{to}',
  teamPlanForgeQueueRolls: '≈ {rolls} rolagens',
  teamPlanForgeQueueEssence: '≈ {essence} de essência',
  teamPlanForgeQueueGold: '≈ {gold} ouro',
  teamPlanForgeQueueTotal: 'Esperado para todos os {count}',
  teamPlanForgeQueueNoForecast: 'Sem estimativa — o nível deste item não está na tabela de forja.',
  teamPlanForgeQueueLegend:
    'Sólido: de +1 a +4 sempre acerta. Degradê: cada rolagem acima de +4 — quanto mais claro o segmento, menor a chance, e cada falha seguida soma 5 pontos à próxima rolagem. A partir da rolagem do +12, uma falha derruba a peça um nível, nunca abaixo de +10. Os números são valores esperados ao longo de muitas tentativas.',
};

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
  teamPlanForgeQueueHeading: 'Fila de forja',
  teamPlanForgeQueueLadderAria: 'Escada de forja de {item}: +{from} a +{to}',
  teamPlanForgeQueueRolls: '≈ {rolls} rolagens',
  teamPlanForgeQueueSafeJumpOne: '1 salto seguro',
  teamPlanForgeQueueSafeJumpMany: '{count} saltos seguros',
  teamPlanForgeQueueGold: '≈ {gold} ouro',
  teamPlanForgeQueueTotal: 'Esperado para todos os {count}',
  teamPlanForgeQueueNoForecast: 'Sem estimativa — o nível deste item não está na tabela de forja.',
  teamPlanForgeQueueLegend:
    'Sólido: até +8 em um salto seguro, que não falha. Degradê: cada rolagem acima de +8 — quanto mais claro o segmento, menor a chance; uma falha volta para +8 (uma falha no +15 volta para +0). Os números são valores esperados ao longo de muitas tentativas.',
};

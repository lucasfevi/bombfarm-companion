/**
 * One item's journey through an Optimizer plan: where it comes from, what forge work it needs,
 * and — when the plan takes it off a hero and hands it back — why.
 *
 * Split out of `team-plan.ts` because the removal strings are read together and have to agree
 * with each other: the reason a piece comes off is the same reason the crowding toggle exists, so
 * a wording change on one side that is not made on the other reads as a contradiction to the one
 * person who sees both.
 */
export const en = {
  teamPlanFlowLocationInventory: 'Inventory',
  teamPlanFlowRowFromLabel: 'From',
  teamPlanFlowRowExisting: 'Existing item — no change',
  teamPlanFlowRemovedHeading: 'Taken off this hero',
  teamPlanFlowRowRemovedToInventory: 'Goes back to your inventory',
  teamPlanFlowRemovedWhyCrowded:
    'The field is full, so this hero waiting in the House serves the squad better than wearing this. Turn on "Keep every hero geared" to plan without that.',
  teamPlanFlowRemovedWhyOther:
    'No other hero in scope can use it, so it waits in your inventory.',
  teamPlanFlowRowForge: 'Forge from +{from} to +{to}',
};

export const pt: Record<keyof typeof en, string> = {
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
};

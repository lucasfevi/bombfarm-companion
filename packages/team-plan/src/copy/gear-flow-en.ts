/**
 * One item's journey through an Optimizer plan: where it comes from, what forge work it needs,
 * and — when the plan takes it off a hero and hands it back — why.
 *
 * Split out because the removal strings are read together and have to agree with each other: the
 * reason a piece comes off is the same reason the crowding toggle exists, so a wording change on
 * one side that is not made on the other reads as a contradiction to the one person who sees both.
 */
export const teamPlanGearFlowEn = {
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
  teamPlanFlowSlotEmpty: 'No item proposed',
  teamPlanForgeQueueHeading: 'Forge queue',
  teamPlanForgeQueueLadderAria: 'Forge ladder for {item}: +{from} to +{to}',
  teamPlanForgeQueueRolls: '≈ {rolls} rolls',
  teamPlanForgeQueueEssence: '≈ {essence} essence',
  teamPlanForgeQueueGold: '≈ {gold} gold',
  teamPlanForgeQueueTotal: 'Expected for all {count}',
  teamPlanForgeQueueNoForecast: 'No estimate — this item level is not on the forge table.',
  teamPlanForgeQueueLegend:
    'Solid: +1 to +4 always land. Fading: each roll past +4 — the lighter the segment, the lower its chance, and every miss in a row adds 5 points to the next roll. A miss drops the piece one level, and a miss from +12 up drops it to +10. Figures are expected values over many attempts.',
} as const;

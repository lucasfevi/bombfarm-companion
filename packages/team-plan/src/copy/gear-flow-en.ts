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
  teamPlanForgeQueueSafeJumpOne: '1 safe jump',
  teamPlanForgeQueueSafeJumpMany: '{count} safe jumps',
  teamPlanForgeQueueGold: '≈ {gold} gold',
  teamPlanForgeQueueTotal: 'Expected for all {count}',
  teamPlanForgeQueueNoForecast: 'No estimate — this item level is not on the forge table.',
  teamPlanForgeQueueLegend:
    'Solid: up to +8 in one safe jump, which cannot fail. Fading: each roll past +8 — the lighter the segment, the lower its chance; a failed roll drops back to +8 (a failed +15 drops to +0). Figures are expected values over many attempts.',
} as const;

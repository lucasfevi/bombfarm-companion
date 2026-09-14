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
} as const;

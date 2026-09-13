import { TeamPlanEmptyPanel } from '@bombfarm/team-plan/components';
import type { TeamPlanEmptyStateKind } from '@bombfarm/team-plan/model';
import type { Strings } from '@/shared/i18n';

/** The three empty-state panels the screen's `slots.emptyState` slot renders, each carrying the
 *  web's own import dialog as its action — a save-export flow only this host has. */
export function webTeamPlanEmptyState(
  kind: TeamPlanEmptyStateKind,
  strings: Strings,
  onImport: () => void,
) {
  const action = { label: strings.teamPlanImportCta, onPress: onImport };
  if (kind === 'noRoster') {
    return (
      <TeamPlanEmptyPanel
        title={strings.teamPlanEmptyNoRosterTitle}
        body={strings.teamPlanEmptyNoRosterBody}
        action={action}
      />
    );
  }
  if (kind === 'noInventory') {
    return (
      <TeamPlanEmptyPanel
        title={strings.teamPlanEmptyNoInventoryTitle}
        body={strings.teamPlanEmptyNoInventoryBody}
        action={action}
      />
    );
  }
  return (
    <TeamPlanEmptyPanel
      title={strings.teamPlanEmptyAllLeaveAloneTitle}
      body={strings.teamPlanEmptyAllLeaveAloneBody}
      action={action}
    />
  );
}

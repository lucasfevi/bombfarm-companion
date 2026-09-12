'use client';

import { useMemo } from 'react';

import type { AdvisorPipelineResult } from '@bombfarm/domain/advisor-pipeline';
import { SLOTS, type Loadout } from '@bombfarm/domain/gear';
import {
  FieldRequired,
  Panel,
  colClass,
  numberFormatterFor,
  panelHClass,
  panelTitleClass,
} from '@bombfarm/ui';
import type { GearPanelCopy, Lang } from '../copy';
import { gearPanelReading } from '../model/gear-panel';
import { GearSlotsGrid, type GearSlotEditorSlot, type SlotPatchHandler } from './gear-slots-grid';
import { GearSlotStatsGrid } from './gear-slot-stats-grid';
import { GearCompareSection, type GearCompareEditing } from './gear-compare-section';

/**
 * The callbacks a host supplies to make the Items panel editable, current loadout and clone alike.
 * Absent, the same figures render with no way to change them — see `gearPanelReading`.
 */
export type GearEditing = GearCompareEditing & {
  onPatchSlot: SlotPatchHandler;
};

export function GearTab({
  t,
  lang,
  loadout,
  altLoadout,
  pipeline,
  editing,
  renderSlot,
}: {
  t: GearPanelCopy;
  lang: Lang;
  loadout: Loadout;
  altLoadout: Loadout | null;
  pipeline: AdvisorPipelineResult;
  editing?: GearEditing | undefined;
  renderSlot?: GearSlotEditorSlot | undefined;
}) {
  const boundFormatNumber = useMemo(() => numberFormatterFor(lang), [lang]);
  const reading = gearPanelReading({
    editable: !!editing,
    hasSlotEditor: !!renderSlot,
    hasAltLoadout: !!altLoadout,
  });

  const hasGear = SLOTS.some((slot) => loadout[slot] != null);

  return (
    <main className={colClass}>
      <Panel>
        <div className={panelHClass}>
          <h2 className={panelTitleClass}>{t.panelItems}</h2>
          <FieldRequired show={!hasGear}>{t.fieldRequired}</FieldRequired>
        </div>
        {reading.showSlotEditors && editing && renderSlot && (
          <GearSlotsGrid loadout={loadout} onPatchSlot={editing.onPatchSlot} renderSlot={renderSlot} />
        )}
        {hasGear && <GearSlotStatsGrid loadout={loadout} t={t} formatNumber={boundFormatNumber} />}
        <GearCompareSection
          t={t}
          lang={lang}
          loadout={loadout}
          altLoadout={altLoadout}
          pipeline={pipeline}
          editing={editing}
          renderSlot={renderSlot}
        />
      </Panel>
    </main>
  );
}

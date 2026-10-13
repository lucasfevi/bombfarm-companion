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
import { currentGearEditable } from '../model/gear-panel';
import type { GearPanelCopy, Lang, SheetCloneCopy, StatPanelCopy } from '../copy';
import { GearSlotsGrid, type GearSlotEditorSlot, type SlotPatchHandler } from './gear-slots-grid';
import { GearSlotCardsGrid } from './gear-slot-card';
import { GearCompareSection, type GearCompareEditing } from './gear-compare-section';
import { SheetCloneTable, type SheetCloneTableInput } from './sheet-clone-table';

/**
 * The callbacks a host supplies to make the Items panel editable, current loadout and clone alike.
 * Absent, the same figures render with no way to change them — see `gearPanelReading`.
 */
export type GearEditing = GearCompareEditing & {
  onPatchSlot?: SlotPatchHandler | undefined;
};

export type GearCloneSheet = {
  t: StatPanelCopy & SheetCloneCopy;
  input: SheetCloneTableInput | null;
};

export function GearTab({
  t,
  lang,
  loadout,
  altLoadout,
  pipeline,
  editing,
  renderSlot,
  cloneSheet,
}: {
  t: GearPanelCopy;
  lang: Lang;
  loadout: Loadout;
  altLoadout: Loadout | null;
  pipeline: AdvisorPipelineResult;
  editing?: GearEditing | undefined;
  renderSlot?: GearSlotEditorSlot | undefined;
  cloneSheet?: GearCloneSheet | undefined;
}) {
  const boundFormatNumber = useMemo(() => numberFormatterFor(lang), [lang]);
  const currentEditable = currentGearEditable({
    canPatchCurrent: !!editing?.onPatchSlot,
    hasSlotEditor: !!renderSlot,
  });
  const hasGear = SLOTS.some((slot) => loadout[slot] != null);

  return (
    <main className={colClass}>
      <Panel className="@container min-w-0">
        <div className={panelHClass}>
          <h2 className={panelTitleClass}>{t.panelItems}</h2>
          <FieldRequired show={!hasGear}>{t.fieldRequired}</FieldRequired>
        </div>
        {currentEditable && editing?.onPatchSlot && renderSlot ? (
          <GearSlotsGrid
            loadout={loadout}
            onPatchSlot={editing.onPatchSlot}
            renderSlot={renderSlot}
            aria-label={`${t.slotEditor} · ${t.compareCurrent}`}
          />
        ) : (
          <GearSlotCardsGrid
            loadout={loadout}
            lang={lang}
            t={t}
            formatNumber={boundFormatNumber}
            aria-label={t.slotStats}
          />
        )}
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
      {cloneSheet?.input && altLoadout ? (
        <SheetCloneTable
          t={cloneSheet.t}
          lang={lang}
          input={cloneSheet.input}
          loadout={loadout}
          altLoadout={altLoadout}
        />
      ) : null}
    </main>
  );
}

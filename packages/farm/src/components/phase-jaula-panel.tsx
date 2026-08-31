'use client';

import { useMemo } from 'react';

import {
  Panel,
  StatList,
  numberFormatterFor,
  panelHClass,
  panelTitleClass,
  phasesBoardJaulaClass,
  tipClass,
} from '@bombfarm/ui';
import type { PhaseIntelGlobal } from '@bombfarm/domain/phase-intel';
import { WIKI_ASSETS_BASE } from '@bombfarm/domain/wiki-assets';
import { jaulaItems } from '../model/phase-fact-items';
import { useFarmCopy } from './farm-copy-context';

const cageArtSrc = `${WIKI_ASSETS_BASE}/env/jaula.png`;

export function PhaseJaulaPanel({ intel }: { intel: PhaseIntelGlobal }) {
  const { t, lang } = useFarmCopy();
  const boundFormatNumber = useMemo(() => numberFormatterFor(lang), [lang]);

  return (
    <Panel className={phasesBoardJaulaClass}>
      <div className={panelHClass}>
        <h2 className={panelTitleClass}>{t.phasesJaulaSection}</h2>
      </div>
      <img
        src={cageArtSrc}
        alt=""
        aria-hidden
        draggable={false}
        className="mx-auto mb-2 h-20 w-auto object-contain"
      />
      <p className={tipClass}>{t.phasesJaulaSectionDesc}</p>
      <StatList variant="phases" items={jaulaItems(intel, t, boundFormatNumber, lang)} />
    </Panel>
  );
}

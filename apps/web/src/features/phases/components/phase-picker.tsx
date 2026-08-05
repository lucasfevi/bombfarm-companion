'use client';

import { useCallback, useMemo } from 'react';
import { Panel, Select } from '@bombfarm/ui';
import type { Lang, Strings } from '@/shared/i18n';
import {
  firstPhaseForAto,
  formatMapOptionLabel,
  gameDifficultyLabel,
  listMapsForAto,
  phaseMapCoord,
  GAME_DIFFICULTY_EN,
} from '@bombfarm/domain/phase-wiki';

const fieldLabelClass =
  'flex flex-col gap-[3px] text-[11px] tracking-[0.03em] text-muted uppercase';

export function PhasePicker({
  phase,
  onPhase,
  t,
  lang,
}: {
  phase: number;
  onPhase: (phase: number) => void;
  t: Strings;
  lang: Lang;
}) {
  const coord = phaseMapCoord(phase);
  const ato = coord?.ato ?? 1;

  const mapOptions = useMemo(() => listMapsForAto(ato, lang), [ato, lang]);

  const onDifficulty = useCallback(
    (nextAto: number) => {
      const current = phaseMapCoord(phase);
      if (!current) {
        onPhase(firstPhaseForAto(nextAto));
        return;
      }
      const maps = listMapsForAto(nextAto, lang);
      const preserved = maps.find(
        (row) => row.mundo === current.mundo && row.subIndex === current.subIndex,
      );
      onPhase(preserved?.phase ?? maps[0]?.phase ?? 1);
    },
    [onPhase, phase, lang],
  );

  return (
    <Panel focus>
      <div className="flex flex-wrap items-end gap-3">
        <label className={`${fieldLabelClass} w-29 shrink-0`}>
          <span>{t.phasesDifficultyLabel}</span>
          <Select
            size="compact"
            className="w-full"
            aria-label={t.phasesDifficultyLabel}
            value={String(ato)}
            onChange={(event) => onDifficulty(Number(event.target.value))}
          >
            {GAME_DIFFICULTY_EN.map((_, index) => {
              const band = index + 1;
              return (
                <option key={band} value={band}>
                  {gameDifficultyLabel(band, lang)}
                </option>
              );
            })}
          </Select>
        </label>
        <label className={`${fieldLabelClass} w-3xs shrink-0`}>
          <span>{t.phasesMapLabel}</span>
          <Select
            size="compact"
            className="w-3xs"
            aria-label={t.phasesMapLabel}
            value={String(phase)}
            onChange={(event) => onPhase(Number(event.target.value))}
          >
            {mapOptions.map((row) => (
              <option key={row.phase} value={row.phase}>
                {formatMapOptionLabel(row)}
              </option>
            ))}
          </Select>
        </label>
      </div>
    </Panel>
  );
}

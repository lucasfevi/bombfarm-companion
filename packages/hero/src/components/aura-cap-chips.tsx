'use client';

import { Tooltip, cn, formatNumber } from '@bombfarm/ui';
import { teamAuraReadout } from '@bombfarm/domain/ability-effect-readout';
import { abilityEffectText, abilityName, abilityReadoutText } from '@bombfarm/domain/game-labels';
import { PASSAGEM_BASTAO_CAP } from '@bombfarm/domain/model';
import {
  TEAM_AURA_SWITCH_IDS,
  TEAM_BUFF_CAP,
  type AurasAtCap,
  type TeamAuraId,
} from '@bombfarm/domain/team-buffs';
import { AbilityIcon } from '@bombfarm/game-art';
import { heroCopyFor, sub, type Lang } from '../copy';

function capAmount(auraId: TeamAuraId): number {
  return auraId === 'passagem_bastao' ? PASSAGEM_BASTAO_CAP * 100 : TEAM_BUFF_CAP[auraId];
}

/** "+20% attack" — each aura's cap in the unit the Heroes screen's aura cards print it in. */
export function auraCapText(auraId: TeamAuraId, lang: Lang): string {
  return abilityReadoutText(teamAuraReadout(auraId, capAmount(auraId)), lang, (value, decimals) =>
    formatNumber(value, lang, decimals),
  );
}

const chipClass =
  'relative inline-grid cursor-pointer rounded-sm border-0 bg-transparent p-0 outline-none focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';
const tileClass = 'motion-safe:transition-[border-color,opacity,background-color] motion-safe:duration-[140ms] motion-safe:ease-out';
const litTileClass = 'border-accent bg-[color-mix(in_oklch,var(--accent)_32%,var(--bg-2))]';
const dotClass =
  'pointer-events-none absolute -top-0.5 -right-0.5 size-2 rounded-full border-[1.5px] border-surface bg-accent';

/**
 * Every team aura the game has as one press-toggle each, lit with the switch's own accent while
 * a rotating surface prices it at its cap. The tile is the icon the Heroes screen draws for the
 * same aura, so the six read as the auras themselves and not as six unnamed buttons; the name,
 * the effect and the cap sit behind hover and in the accessible name, since a chip has no room
 * for a word. Needs a `Tooltip.Provider` above it.
 *
 * `value` is the domain's own `AurasAtCap` list, and `onToggle` reports one aura at a time — the
 * host decides how the list is stored, and whether flipping one clears a plan.
 */
export function AuraCapChips({
  value,
  onToggle,
  lang,
  className,
}: {
  value: AurasAtCap;
  onToggle: (auraId: TeamAuraId, atCap: boolean) => void;
  lang: Lang;
  className?: string;
}) {
  const t = heroCopyFor(lang);
  return (
    <div className={cn('flex items-center gap-1', className)} role="group" aria-label={t.heroDetailAurasTeamGroup}>
      {TEAM_AURA_SWITCH_IDS.map((auraId) => {
        const atCap = value.includes(auraId);
        const name = abilityName(auraId, lang);
        const tip = `${name} — ${abilityEffectText(auraId, lang)} · ${auraCapText(auraId, lang)}`;
        return (
          <Tooltip.Root key={auraId}>
            <Tooltip.Trigger
              type="button"
              aria-pressed={atCap}
              aria-label={sub(t.heroDetailAuraSwitchAria, { name })}
              className={chipClass}
              data-testid={`aura-cap-${auraId}`}
              onClick={() => onToggle(auraId, !atCap)}
            >
              <AbilityIcon code={auraId} size="sm" className={cn(tileClass, atCap ? litTileClass : 'opacity-40')} />
              {atCap ? <span className={dotClass} aria-hidden="true" /> : null}
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner sideOffset={6}>
                <Tooltip.Popup>
                  <p className="m-0 max-w-72 text-[11px] leading-snug">{tip}</p>
                </Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        );
      })}
    </div>
  );
}

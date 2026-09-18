import type { SkillArm } from '@bombfarm/domain/skill-tree';

/**
 * One hue per path, lifted to the same lightness so no arm reads as more important than another.
 * The medallion art is bronze on every arm, so the ring, the edges and the glow are the only
 * places a path's colour can live. Gold keeps the wallet's gold — it is the one path whose name
 * is the currency — and the hub, which belongs to no path, is drawn in it too. Neutral Axis is
 * the silver the game's own name for it suggests.
 */
export const SKILL_ARM_COLOUR: Readonly<Record<SkillArm, string>> = {
  hub: 'var(--gold)',
  dano: 'oklch(70% 0.19 28)',
  crit: 'oklch(74% 0.17 350)',
  velocidade: 'oklch(80% 0.13 200)',
  ouro: 'var(--gold)',
  drop: 'oklch(78% 0.16 140)',
  energia: 'oklch(74% 0.15 255)',
  geo: 'oklch(74% 0.16 300)',
  neutro: 'oklch(82% 0.02 48)',
};

export function skillArmColour(arm: SkillArm): string {
  return SKILL_ARM_COLOUR[arm];
}

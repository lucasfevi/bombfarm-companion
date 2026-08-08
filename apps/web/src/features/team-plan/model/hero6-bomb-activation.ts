/** Hero 6 taskbar bomb-activation loop extracted from BombFarmPlaytest PCK. */
export const HERO6_BOMB_ACTIVATION_FRAME_MS = 80;

export const HERO6_BOMB_ACTIVATION_FRAMES = Array.from({ length: 18 }, (_, index) => {
  const frameNumber = String(index + 1).padStart(3, '0');
  return `/wiki-assets/hero/hero6-bomb-activation/hero_6_bomb_activation_${frameNumber}.png`;
});

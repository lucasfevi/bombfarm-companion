export const HERO6_MENU_IDLE_FRAME_MS = 100;

// Source filenames are numbered 1..15 with no zero-padding, so building the list from the
// numeric index (rather than reading and sorting the directory) is what keeps frame 10 from
// landing between frame 1 and frame 2.
export const HERO6_MENU_IDLE_FRAMES = Array.from(
  { length: 15 },
  (_, index) => `/wiki-assets/hero/hero6-menu-idle/hero6_idle_menu${String(index + 1)}.png`,
);

/**
 * Which of the two roster presentations the Heroes screen is showing, and what picking a hero
 * does in each.
 *
 * The rail and the board are not two skins of one list. The rail sits beside the detail, so
 * picking a hero there changes what the detail is about and you stay where you are. The board
 * takes the whole screen precisely so it can show every hero's roll, pool and gear at once — the
 * detail is not on screen, so picking a hero there is the act of going to look at it, and leaving
 * the reader on the board would swallow the click.
 *
 * That asymmetry is the whole decision, and it is here rather than in a handler inside the view
 * because a handler in JSX is a rule nothing can prove.
 */
export type RosterViewMode = 'rail' | 'board';

export function nextRosterViewMode(mode: RosterViewMode): RosterViewMode {
  return mode === 'rail' ? 'board' : 'rail';
}

/** What the toggle offers: the mode you are NOT in, because a control is named for what it does. */
export function rosterToggleLabel(
  mode: RosterViewMode,
  labels: { rail: string; board: string },
): string {
  return mode === 'rail' ? labels.board : labels.rail;
}

export type HeroPickOutcome = {
  readonly heroId: string;
  /** True when picking should also return to the rail, because the detail is not on screen. */
  readonly showDetail: boolean;
};

export function heroPickOutcome(mode: RosterViewMode, heroId: string): HeroPickOutcome {
  return { heroId, showDetail: mode === 'board' };
}

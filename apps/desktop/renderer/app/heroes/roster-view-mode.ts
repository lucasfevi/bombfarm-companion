/**
 * Which of the two roster presentations the Heroes screen is showing, and what picking a hero
 * does in each.
 *
 * Named `list`/`cards` after the shared control that switches them — the same pair of glyphs the
 * Inventory switches its own two layouts with — so one word means one thing in both screens.
 *
 * The list and the board are not two skins of one roster. The list sits beside the detail, so
 * picking a hero there changes what the detail is about and you stay where you are. The board
 * takes the whole screen precisely so it can show every hero's roll, pool and gear at once — the
 * detail is not on screen, so picking a hero there is the act of going to look at it, and leaving
 * the reader on the board would swallow the click.
 *
 * That asymmetry is the whole decision, and it is here rather than in a handler inside the view
 * because a handler in JSX is a rule nothing can prove.
 */
export type RosterViewMode = 'list' | 'cards';

export type HeroPickOutcome = {
  readonly heroId: string;
  /** True when picking should also return to the list, because the detail is not on screen. */
  readonly showDetail: boolean;
};

export function heroPickOutcome(mode: RosterViewMode, heroId: string): HeroPickOutcome {
  return { heroId, showDetail: mode === 'cards' };
}

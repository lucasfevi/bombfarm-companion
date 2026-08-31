/**
 * The two step illustrations, as pure functions of the second they are asked for — the same
 * arrangement the Live replica uses, for the same reasons: server and client agree on frame 0,
 * reduced motion freezes there, and a test can ask for any instant.
 *
 * The cursor is described as an OFFSET from where it ends up, never as a position inside the card.
 * Percentages of a card whose width changes with the viewport put the pointer somewhere near the
 * thing it is meant to be clicking; the component anchors it to that element and this only says
 * how far away it still is.
 */
export const DOUBLE_CLICK_LOOP_SECONDS = 3.2;
export const PERMISSION_LOOP_SECONDS = 5;

export interface CursorApproach {
  /** Pixels right of and below the target, easing to 0 as the cursor arrives. */
  readonly offsetX: number;
  readonly offsetY: number;
  readonly pressed: boolean;
}

function approach(
  seconds: number,
  travelSeconds: number,
  fromX: number,
  fromY: number,
): { offsetX: number; offsetY: number } {
  const progress = Math.min(1, seconds / travelSeconds);
  const eased = 1 - Math.pow(1 - progress, 3);
  return { offsetX: fromX * (1 - eased), offsetY: fromY * (1 - eased) };
}

export interface DoubleClickFrame extends CursorApproach {
  readonly opening: boolean;
}

export function doubleClickFrameAt(elapsed: number): DoubleClickFrame {
  const seconds = Math.max(0, Math.min(DOUBLE_CLICK_LOOP_SECONDS, elapsed));
  const firstPress = seconds >= 1.25 && seconds < 1.45;
  const secondPress = seconds >= 1.6 && seconds < 1.8;

  return {
    ...approach(seconds, 1.1, 58, 46),
    pressed: firstPress || secondPress,
    opening: seconds >= 1.9,
  };
}

export interface PermissionFrame extends CursorApproach {
  readonly allowed: boolean;
}

/**
 * Allowed, then withdrawn, then allowed again — the withdrawn beat is the point of the drawing:
 * the line under it flips to "nothing to show", which is what the app does without this.
 */
export function permissionFrameAt(elapsed: number): PermissionFrame {
  const seconds = Math.max(0, Math.min(PERMISSION_LOOP_SECONDS, elapsed));
  const firstPress = seconds >= 1.0 && seconds < 1.2;
  const secondPress = seconds >= 3.0 && seconds < 3.2;

  return {
    ...approach(seconds, 0.9, 34, 40),
    pressed: firstPress || secondPress,
    allowed: seconds < 1.1 || seconds >= 3.1,
  };
}

/**
 * Short vibrations for the moments that are worth feeling.
 *
 * A habit tracker is mostly one gesture repeated for months, and on a phone a
 * tap that produces nothing but a colour change feels inert. These are
 * deliberately small: the tick is a tick, and only a boss kill is allowed to
 * be a pattern.
 *
 * Everything is best-effort. `navigator.vibrate` is absent on iOS entirely,
 * throws in some embedded webviews, and is a no-op when the device is on
 * silent — so nothing here may ever be load-bearing, and none of it is.
 */

export type HapticKind = 'tick' | 'undo' | 'levelUp' | 'tier' | 'victory' | 'refused';

/** Durations in ms; arrays alternate vibrate/pause. */
const PATTERNS: Record<HapticKind, number | number[]> = {
  // The everyday one. Short enough to be a confirmation, not an event.
  tick: 12,
  // Softer than the tick: taking something back shouldn't feel like doing it.
  undo: 8,
  levelUp: [18, 40, 26],
  tier: [14, 30, 14, 30, 22],
  victory: [26, 50, 26, 50, 46],
  // Two quick taps, the universal "no".
  refused: [10, 60, 10],
};

let enabled = true;

/** Settings can silence these without every caller having to check. */
export function setHapticsEnabled(value: boolean): void {
  enabled = value;
}

export function hapticsEnabled(): boolean {
  return enabled;
}

export function haptic(kind: HapticKind): void {
  if (!enabled) return;
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  // Some webviews expose vibrate and then throw on call, and a failed buzz is
  // never worth breaking a completion over.
  try {
    navigator.vibrate(PATTERNS[kind]);
  } catch {
    // Ignored on purpose.
  }
}

/**
 * True where the API exists at all — used only to decide whether showing a
 * haptics toggle in Settings would be honest. iOS has no vibrate API, so on
 * an iPhone the setting is hidden rather than shown doing nothing.
 */
export function hapticsSupported(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}

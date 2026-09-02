import type { CheatDayState, Vacation } from '../types';
import { todayStr } from './date';
import { getActiveVacation, getVacationDates } from './vacation';

/**
 * The single answer to "which days don't count against you".
 *
 * Vacations, Cheat Days and Rest Day tokens all forgive a day, and every part
 * of the app that cares — decay, the weekly boss target, the reminder, the
 * quest-log banner — has to agree on the same set. They previously did not:
 * the boss target was frozen using vacations *and* rest days, while the card
 * and the payout used vacations alone, so a Cheat Day left the screen showing
 * 252 while the store had saved 180.
 */
export function getForgivenDates(cheatDay: CheatDayState, vacations: Vacation[]): string[] {
  return [...cheatDay.usedDates, ...getVacationDates(vacations)];
}

/** The same set, as a Set, for the callers that do lookups rather than loops. */
export function getForgivenSet(cheatDay: CheatDayState, vacations: Vacation[]): Set<string> {
  return new Set(getForgivenDates(cheatDay, vacations));
}

/** A day nothing is owed on — a booked vacation, a Cheat Day, or a Rest Day. */
export function isRestDay(cheatDay: CheatDayState, vacations: Vacation[], date = todayStr()): boolean {
  if (cheatDay.usedDates.includes(date)) return true;
  return getActiveVacation(vacations, date) !== null;
}

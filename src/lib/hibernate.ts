import type { Habit } from '../types';
import { addDays, daysBetween, todayStr } from './date';

/**
 * A quest that sleeps without dying.
 *
 * Vacation mode is global and capped at twice a year; archiving is how a quest
 * ends and takes the streak with it. Neither covers "I don't run outdoors in
 * February" — a single quest, out of season, for months, that you fully intend
 * to pick up again.
 *
 * A hibernating quest is skipped by the decay pass, left out of the weekly
 * boss target, and hidden from the log. Its streak, bonus tier and history are
 * untouched: it simply resumes. The one thing it is *not* is a way to dodge a
 * bad week — waking is a date you set when you start, and the decay cursor is
 * moved forward on waking so the sleeping days can never be charged for
 * retroactively.
 */

/** Offered lengths, in days. Seasonal habits are the point, so these are long. */
export const HIBERNATE_OPTIONS: { days: number; label: string }[] = [
  { days: 30, label: 'A month' },
  { days: 60, label: 'Two months' },
  { days: 90, label: 'A season' },
  { days: 180, label: 'Half a year' },
];

export function isHibernating(habit: Habit, today = todayStr()): boolean {
  return !!habit.hibernatingUntil && habit.hibernatingUntil > today;
}

/** Days until it wakes, or null if it isn't asleep. */
export function daysUntilWake(habit: Habit, today = todayStr()): number | null {
  if (!isHibernating(habit, today)) return null;
  return Math.max(1, daysBetween(today, habit.hibernatingUntil!));
}

export function wakeDate(days: number, from = todayStr()): string {
  return addDays(from, days);
}

/**
 * The state a waking quest should be restored to.
 *
 * The decay cursor jumps to yesterday so the pass starts from today rather
 * than walking back over months of sleep and charging for every one of them.
 * That single line is the whole difference between a quest that hibernates and
 * a quest that comes back owing a year of XP.
 */
export function wake(habit: Habit, today = todayStr()): Habit {
  return {
    ...habit,
    hibernatingUntil: null,
    decayedThroughDate: addDays(today, -1),
    missedSinceCompletion: 0,
  };
}

/** True where a quest should appear in the log and count toward the boss. */
export function isAwake(habit: Habit, today = todayStr()): boolean {
  return !habit.archived && !isHibernating(habit, today);
}

import type { CheatDayState, Habit, Vacation } from '../types';
import { isScheduledDay } from './rpg';
import { isAwake } from './hibernate';
import { isRestDay } from './forgiveness';

/**
 * A reminder attached to the quest rather than to the day.
 *
 * One reminder at 19:00 saying "you have 4 quests left" is the wrong shape for
 * most of them. Vitamins belong to breakfast, stretching belongs to bedtime,
 * and a single evening nudge is too late for the first and too vague for
 * either. So a quest can carry its own time, and what arrives is the quest's
 * name at the hour it actually wants doing.
 *
 * The global reminder stays, and stays useful — it's the catch-all for
 * everything without a time of its own. A quest with its own time is left out
 * of that count, because being told twice about the same quest is how someone
 * turns notifications off altogether.
 */

/** HH:MM in 24h, which is what `<input type="time">` produces. */
export function isValidTime(value: unknown): value is string {
  return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

/** Quests that carry their own time, so the global reminder skips them. */
export function hasOwnReminder(habit: Habit): boolean {
  return isValidTime(habit.reminderTime);
}

/**
 * Whether a quest is one the app should still be nudging about today at all:
 * awake, due today, and not already done.
 */
export function isOutstanding(habit: Habit, today: string): boolean {
  return isAwake(habit, today) && isScheduledDay(habit, today) && habit.lastCompletedDate !== today;
}

/**
 * The quests whose own reminder is due right now.
 *
 * `now` is compared with `>=` rather than `===` for the same reason the global
 * reminder does: an exact minute match gives a one-minute window per day, so
 * opening the app at 07:05 for an 07:00 reminder meant it silently never
 * fired. A rest day or a vacation silences these exactly as it silences the
 * global one — the whole point of a day off is not being nagged on it.
 */
export function dueReminders(
  habits: Habit[],
  now: string,
  today: string,
  cheatDay?: CheatDayState,
  vacations: Vacation[] = [],
): Habit[] {
  if (cheatDay && isRestDay(cheatDay, vacations, today)) return [];
  return habits.filter(
    (h) =>
      hasOwnReminder(h) &&
      isOutstanding(h, today) &&
      h.lastRemindedDate !== today &&
      now >= h.reminderTime!,
  );
}

/** What one quest's notification says. Its name is the whole value of it. */
export function reminderBody(habit: Habit): string {
  return `${habit.name} is waiting.`;
}

/**
 * What `lastRemindedDate` should be when a reminder is first set or moved.
 *
 * Setting a reminder is itself an interaction with the quest, and a
 * notification arriving seconds later about the thing you are looking at
 * right now is noise, not a nudge. So a time that has already gone by today
 * counts as handled and the reminder starts tomorrow; a time still to come
 * is left open, and speaks when it arrives.
 *
 * This is the one place the at-or-after rule is deliberately not applied:
 * that rule exists so a reminder survives the app being closed at 07:00, not
 * so that saving a form can ring a bell.
 */
export function initialRemindedDate(
  time: string | null | undefined,
  now: string,
  today: string,
): string | null {
  return isValidTime(time) && now >= time ? today : null;
}

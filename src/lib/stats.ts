import type { AttributeKey, CompletionEntry, Habit } from '../types';
import { addDays, dayOfWeek, parseDate, weekdayLabel } from './date';
import { isScheduledDay } from './rpg';

/**
 * Everything the stats screen shows, derived from the completion log.
 *
 * All of it is computed rather than stored, so it can't drift out of sync with
 * the log and needs no migration. Rates are measured against *scheduled*
 * occurrences: counting every calendar day would punish a Mon/Wed/Fri quest for
 * the four days it was never due.
 */

/**
 * How far back the completion rate looks.
 *
 * Measuring over a quest's whole life made the number useless: a quest created
 * in January that you have kept perfectly for the last month still read 12%,
 * and could never recover no matter what you did. A rolling window answers the
 * question you can actually act on — how am I doing lately.
 */
export const RATE_WINDOW_DAYS = 30;

export interface QuestStat {
  habitId: string;
  name: string;
  attribute: AttributeKey;
  /** Scheduled occurrences inside the window, never before the quest existed. */
  due: number;
  completed: number;
  /** 0–100, or null when the quest has never yet been due. */
  rate: number | null;
  streak: number;
  bestStreak: number;
}

/** Scheduled occurrences of a habit between two dates, inclusive. */
export function countDue(habit: Habit, from: string, to: string, maxDays = 3650): number {
  const start = habit.createdAt.slice(0, 10) > from ? habit.createdAt.slice(0, 10) : from;
  if (start > to) return 0;
  let count = 0;
  let cursor = start;
  for (let i = 0; i < maxDays && cursor <= to; i += 1) {
    if (isScheduledDay(habit, cursor)) count += 1;
    cursor = addDays(cursor, 1);
  }
  return count;
}

export function getQuestStats(
  habits: Habit[],
  completions: CompletionEntry[],
  today: string,
  windowDays = RATE_WINDOW_DAYS,
): QuestStat[] {
  const from = addDays(today, -(windowDays - 1));
  const byHabit = new Map<string, Set<string>>();
  for (const c of completions) {
    let set = byHabit.get(c.habitId);
    if (!set) {
      set = new Set();
      byHabit.set(c.habitId, set);
    }
    set.add(c.date);
  }

  return habits
    .filter((h) => !h.archived)
    .map((h) => {
      const due = countDue(h, from, today);
      const dates = byHabit.get(h.id) ?? new Set<string>();
      // Only completions on days it was actually due count toward the rate;
      // extra credit shouldn't be able to push a quest past 100%.
      let completed = 0;
      for (const date of dates) {
        if (date >= from && date <= today && isScheduledDay(h, date)) completed += 1;
      }
      return {
        habitId: h.id,
        name: h.name,
        attribute: h.attribute,
        due,
        completed: Math.min(completed, due),
        rate: due === 0 ? null : Math.round((Math.min(completed, due) / due) * 100),
        streak: h.streak,
        bestStreak: h.bestStreak,
      };
    })
    .sort((a, b) => (b.rate ?? -1) - (a.rate ?? -1));
}

export interface WeekdayStat {
  day: number;
  label: string;
  due: number;
  completed: number;
  rate: number | null;
}

/**
 * Completion rate per weekday, so a day you routinely lose is visible rather
 * than just felt. Measured against what was due that weekday, not raw counts —
 * otherwise a quest scheduled only on Mondays would make Monday look best.
 */
export function getWeekdayStats(
  habits: Habit[],
  completions: CompletionEntry[],
  today: string,
): WeekdayStat[] {
  const due = new Array(7).fill(0);
  const done = new Array(7).fill(0);
  const active = habits.filter((h) => !h.archived);

  for (const h of active) {
    let cursor = h.createdAt.slice(0, 10);
    for (let i = 0; i < 3650 && cursor <= today; i += 1) {
      if (isScheduledDay(h, cursor)) due[dayOfWeek(cursor)] += 1;
      cursor = addDays(cursor, 1);
    }
  }
  const ids = new Set(active.map((h) => h.id));
  const byId = new Map(active.map((h) => [h.id, h]));
  for (const c of completions) {
    if (!ids.has(c.habitId) || c.date > today) continue;
    const h = byId.get(c.habitId)!;
    if (!isScheduledDay(h, c.date)) continue;
    done[dayOfWeek(c.date)] += 1;
  }

  return [0, 1, 2, 3, 4, 5, 6].map((day) => ({
    day,
    label: weekdayLabel(day),
    due: due[day],
    completed: Math.min(done[day], due[day]),
    rate: due[day] === 0 ? null : Math.round((Math.min(done[day], due[day]) / due[day]) * 100),
  }));
}

export interface TrendPoint {
  /** Week start (Sunday). */
  weekStart: string;
  xp: Record<AttributeKey, number>;
}

/**
 * XP earned per attribute per week. A running total would hide a bad patch
 * behind everything earned before it; per-week shows the shape of the effort.
 */
export function getAttributeTrend(
  habits: Habit[],
  completions: CompletionEntry[],
  today: string,
  weeks = 8,
): TrendPoint[] {
  const attrByHabit = new Map(habits.map((h) => [h.id, h.attribute]));
  const thisWeekStart = addDays(today, -dayOfWeek(today));
  const points: TrendPoint[] = [];

  for (let i = weeks - 1; i >= 0; i -= 1) {
    const weekStart = addDays(thisWeekStart, -7 * i);
    points.push({
      weekStart,
      xp: { STR: 0, DEX: 0, CON: 0, INT: 0, WIS: 0, CHA: 0 },
    });
  }
  const index = new Map(points.map((p, i) => [p.weekStart, i]));

  for (const c of completions) {
    if (c.date > today) continue;
    const weekStart = addDays(c.date, -dayOfWeek(c.date));
    const at = index.get(weekStart);
    if (at === undefined) continue;
    const attribute = attrByHabit.get(c.habitId);
    if (!attribute) continue;
    points[at].xp[attribute] += c.xpAwarded;
  }
  return points;
}

export function formatWeekLabel(weekStart: string): string {
  const d = parseDate(weekStart);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

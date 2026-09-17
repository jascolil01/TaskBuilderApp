import type { AttributeKey, BossVictory, CompletionEntry, Goal, Habit, Vacation } from '../types';
import { addDays, parseDate } from './date';
import { getWeekEnd, getWeekStart } from './boss';
import { countFor, getLinks } from './goalLinks';
import { isScheduledDay } from './rpg';
import { isHibernating } from './hibernate';
import { getActiveVacation } from './vacation';

/**
 * A look back at the week that just ended.
 *
 * The Stats screen answers "how am I doing" whenever you ask it, which means
 * in practice nobody asks. This is the other thing: a single moment, once a
 * week, that arrives on its own and says what the last seven days actually
 * were. Everything here is derived from the log, so there is nothing to keep
 * up to date and nothing that can drift.
 *
 * Two rules shape the whole thing:
 *
 * - **It leads with what went right.** A week is always a mix, and which half
 *   you are shown first decides whether you open it again next Sunday. The
 *   headline is picked from the best true thing that happened, and the quests
 *   you kept are listed above the ones you didn't.
 *
 * - **Nothing here scolds.** A quest you missed is reported as a number and
 *   left alone. The coach already exists for quests that are genuinely not
 *   working, and it is deliberately a separate, rarer voice — a weekly review
 *   that tells you off is a weekly review you dismiss unread.
 */

export interface QuestWeek {
  habitId: string;
  name: string;
  attribute: AttributeKey;
  /** Scheduled occurrences in the week, counted only from the day it existed. */
  due: number;
  kept: number;
  /** 0-100, or null where it was never due — a quest added on Saturday. */
  rate: number | null;
  perfect: boolean;
}

export interface GoalWeek {
  id: string;
  name: string;
  unit: string;
  /** What linked quests added this week. Manual ticks aren't dated, so they
   *  cannot honestly be attributed to a week and are left out. */
  gained: number;
  progress: number;
  target: number;
  /** Finished during this week. */
  finished: boolean;
}

export interface ReviewNote {
  date: string;
  habitName: string;
  note: string;
}

export interface WeekReview {
  weekStart: string;
  weekEnd: string;
  /** Every quest that was due at least once, kept ones first. */
  quests: QuestWeek[];
  kept: number;
  due: number;
  /** 0-100 across everything due, or null if nothing was. */
  rate: number | null;
  completions: number;
  xp: number;
  gold: number;
  /** Days of the week with at least one completion, 0-7. */
  activeDays: number;
  boss: {
    name: string;
    beaten: boolean;
    goldReward: number;
  } | null;
  goals: GoalWeek[];
  notes: ReviewNote[];
  /** Quests whose streak is longest right now, best first, at most three. */
  streaks: { name: string; streak: number }[];
  /** The same figures for the week before, where there is one to compare to. */
  previous: { kept: number; due: number; rate: number | null; completions: number } | null;
  /** One sentence, the best true thing about the week. */
  headline: string;
  /** True where the week was covered by a trip, which changes what "missed" means. */
  onVacation: boolean;
}

function inWeek(date: string, weekStart: string, weekEnd: string): boolean {
  return date >= weekStart && date <= weekEnd;
}

/** Scheduled occurrences in one week, from the day the quest existed. */
function dueInWeek(habit: Habit, weekStart: string, weekEnd: string): number {
  const created = habit.createdAt.slice(0, 10);
  const from = created > weekStart ? created : weekStart;
  if (from > weekEnd) return 0;
  let n = 0;
  for (let cursor = from; cursor <= weekEnd; cursor = addDays(cursor, 1)) {
    // A quest asleep for the week was never due, so it neither earns credit
    // nor drags the rate down.
    if (isHibernating(habit, cursor)) continue;
    if (isScheduledDay(habit, cursor)) n += 1;
  }
  return n;
}

function summarise(
  habits: Habit[],
  completions: CompletionEntry[],
  weekStart: string,
): { quests: QuestWeek[]; kept: number; due: number; completions: number } {
  const weekEnd = getWeekEnd(weekStart);
  const done = new Map<string, number>();
  let total = 0;
  for (const c of completions) {
    if (!inWeek(c.date, weekStart, weekEnd)) continue;
    done.set(c.habitId, (done.get(c.habitId) ?? 0) + 1);
    total += 1;
  }

  const quests: QuestWeek[] = [];
  let kept = 0;
  let due = 0;
  for (const habit of habits) {
    const questDue = dueInWeek(habit, weekStart, weekEnd);
    const questKept = done.get(habit.id) ?? 0;
    // A quest neither due nor done that week has nothing to report.
    if (questDue === 0 && questKept === 0) continue;
    // Credit is capped at what was due: completing an off-schedule day is
    // worth XP but cannot put a quest above 100% of its own week.
    const counted = Math.min(questKept, questDue);
    kept += counted;
    due += questDue;
    quests.push({
      habitId: habit.id,
      name: habit.name,
      attribute: habit.attribute,
      due: questDue,
      kept: questKept,
      rate: questDue > 0 ? Math.round((counted / questDue) * 100) : null,
      perfect: questDue > 0 && counted >= questDue,
    });
  }

  // Kept ones first, then by how much of the week they covered. The order is
  // the message: this is what you did, and then this is what is left.
  quests.sort((a, b) => Number(b.perfect) - Number(a.perfect) || (b.rate ?? -1) - (a.rate ?? -1) || a.name.localeCompare(b.name));
  return { quests, kept, due, completions: total };
}

function pickHeadline(
  r: Omit<WeekReview, 'headline'>,
): string {
  const perfect = r.quests.filter((q) => q.perfect);
  const finished = r.goals.filter((g) => g.finished);

  if (finished.length > 0) {
    return `You finished ${finished.map((g) => g.name).join(' and ')}.`;
  }
  if (r.due > 0 && r.kept >= r.due) {
    return 'A perfect week. Every quest, every time it was due.';
  }
  if (r.boss?.beaten) {
    return `${r.boss.name} went down.`;
  }
  if (perfect.length >= 3) {
    return `${perfect.length} quests kept perfectly.`;
  }
  const best = r.streaks[0];
  if (best && best.streak >= 14) {
    return `${best.name} is ${best.streak} days deep.`;
  }
  if (perfect.length > 0) {
    return `${perfect.map((q) => q.name).join(' and ')} — kept every time.`;
  }
  if (r.previous && r.previous.rate !== null && r.rate !== null && r.rate > r.previous.rate) {
    return `Better than last week: ${r.rate}% against ${r.previous.rate}%.`;
  }
  if (r.completions > 0) {
    return `${r.completions} quest${r.completions === 1 ? '' : 's'} logged across ${r.activeDays} day${r.activeDays === 1 ? '' : 's'}.`;
  }
  // The honest empty case. Said without any edge to it: a blank week is
  // usually a week where something else was happening.
  return 'A quiet week. They happen, and the next one is not affected.';
}

export function getWeekReview(
  weekStart: string,
  habits: Habit[],
  completions: CompletionEntry[],
  goals: Goal[],
  victories: BossVictory[],
  vacations: Vacation[] = [],
): WeekReview {
  const weekEnd = getWeekEnd(weekStart);
  const week = summarise(habits, completions, weekStart);
  const prevStart = addDays(weekStart, -7);
  const prev = summarise(habits, completions, prevStart);

  const entries = completions.filter((c) => inWeek(c.date, weekStart, weekEnd));
  const names = new Map(habits.map((h) => [h.id, h.name]));

  const goalWeek: GoalWeek[] = [];
  for (const goal of goals) {
    const before = getLinks(goal).reduce(
      (n, link) =>
        n +
        countFor(goal, link.habitId, completions.filter((c) => c.date < weekStart)),
      0,
    );
    const through = getLinks(goal).reduce(
      (n, link) =>
        n + countFor(goal, link.habitId, completions.filter((c) => c.date <= weekEnd)),
      0,
    );
    const gained = Math.max(0, through - before);
    const finished = Boolean(goal.completedOn && inWeek(goal.completedOn, weekStart, weekEnd));
    if (gained === 0 && !finished) continue;
    goalWeek.push({
      id: goal.id,
      name: goal.name,
      unit: goal.unit,
      gained,
      progress: goal.progress,
      target: goal.target,
      finished,
    });
  }

  const victory = victories.find((v) => v.weekStart === weekStart) ?? null;
  const boss = victory
    ? { name: victory.bossName, beaten: true, goldReward: victory.goldReward }
    : null;

  const base: Omit<WeekReview, 'headline'> = {
    weekStart,
    weekEnd,
    quests: week.quests,
    kept: week.kept,
    due: week.due,
    rate: week.due > 0 ? Math.round((week.kept / week.due) * 100) : null,
    completions: week.completions,
    xp: entries.reduce((n, c) => n + c.xpAwarded, 0),
    gold: entries.reduce((n, c) => n + c.goldAwarded, 0),
    activeDays: new Set(entries.map((c) => c.date)).size,
    boss,
    goals: goalWeek,
    // What you said at the time, which is the part of a week you forget
    // fastest and the only part nothing else in the app surfaces.
    notes: entries
      .filter((c) => c.note?.trim())
      .map((c) => ({ date: c.date, habitName: names.get(c.habitId) ?? 'a quest', note: c.note!.trim() }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    streaks: habits
      .filter((h) => !h.archived && h.streak > 0)
      .sort((a, b) => b.streak - a.streak)
      .slice(0, 3)
      .map((h) => ({ name: h.name, streak: h.streak })),
    previous:
      prev.due > 0 || prev.completions > 0
        ? {
            kept: prev.kept,
            due: prev.due,
            rate: prev.due > 0 ? Math.round((prev.kept / prev.due) * 100) : null,
            completions: prev.completions,
          }
        : null,
    onVacation: Boolean(getActiveVacation(vacations, weekStart) || getActiveVacation(vacations, weekEnd)),
  };

  return { ...base, headline: pickHeadline(base) };
}

/**
 * The week a review is owed for, or null.
 *
 * Offered from the first day of the new week, so the week being reviewed is
 * genuinely over. `lastReviewed` is the weekStart of the last one shown, so a
 * review that has been read does not come back, and someone returning after a
 * month away is offered the week just gone rather than four in a row.
 */
export function reviewDue(today: string, lastReviewed?: string | null): string | null {
  const lastWeek = addDays(getWeekStart(today), -7);
  if (lastReviewed && lastReviewed >= lastWeek) return null;
  return lastWeek;
}

/**
 * Month names written out rather than taken from `toLocaleDateString`, which
 * renders September as "Sept" under Node's ICU and "Sep" in a browser. A label
 * that changes shape depending on the device is not worth the convenience.
 */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "14–20 Sep" for the sheet's header. */
export function formatWeekRange(weekStart: string): string {
  const a = parseDate(weekStart);
  const b = parseDate(getWeekEnd(weekStart));
  return a.getMonth() === b.getMonth()
    ? `${a.getDate()}–${b.getDate()} ${MONTHS[b.getMonth()]}`
    : `${a.getDate()} ${MONTHS[a.getMonth()]} – ${b.getDate()} ${MONTHS[b.getMonth()]}`;
}

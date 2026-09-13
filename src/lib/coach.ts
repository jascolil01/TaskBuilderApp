import type { CompletionEntry, Habit } from '../types';
import { EFFORT_ORDER, EFFORT_TIERS, type EffortTier, inferEffort } from './effort';
import { getQuestStats, RATE_WINDOW_DAYS, type QuestStat } from './stats';
import { todayStr } from './date';

/**
 * Noticing when a quest isn't working, and offering the fix.
 *
 * The stats screen has always computed a completion rate per quest and then
 * done nothing with it. That's the most useful signal a habit tracker has and
 * it was decoration.
 *
 * The advice is always the same shape, and it's the advice that actually
 * works: **make it smaller.** A quest you keep failing is not a willpower
 * problem to be scolded about, it's a quest that was set too big — so every
 * suggestion here shrinks something. Nothing scolds, nothing guilt-trips, and
 * retiring a quest is offered as a legitimate answer rather than a failure.
 *
 * Three rules keep it from becoming nagging:
 *
 * - It needs real evidence: a minimum number of chances, not a bad week.
 * - One suggestion at a time, the worst quest only. A list of six things
 *   you're failing is a reason to close the app.
 * - Dismissing silences that quest for a month. If you've decided to keep
 *   going, being asked again on Tuesday is just noise.
 */

/** Below this completion rate over the window, a quest is worth mentioning. */
export const STRUGGLING_RATE = 50;

/** Nothing is judged until it has had at least this many chances. */
export const MIN_OCCURRENCES = 8;

/** How long a dismissal lasts. Long enough that it doesn't feel like nagging. */
export const SNOOZE_DAYS = 30;

export type SuggestionKind = 'easier' | 'less-often' | 'retire';

export interface Suggestion {
  habitId: string;
  name: string;
  rate: number;
  due: number;
  completed: number;
  kind: SuggestionKind;
  /** What the button does, in the user's words. */
  action: string;
  /** Why this is the suggestion, in one sentence. */
  rationale: string;
  /** For 'easier': the tier to drop to. */
  toEffort?: EffortTier;
  /** For 'less-often': the weekdays to keep. */
  toDays?: number[];
}

function easier(effort: EffortTier): EffortTier | null {
  const i = EFFORT_ORDER.indexOf(effort);
  return i > 0 ? EFFORT_ORDER[i - 1] : null;
}

/**
 * Thins a daily quest to three days a week, or halves a weekly one.
 *
 * Picks the days the quest is *already* being kept where it can, rather than
 * an arbitrary Mon/Wed/Fri: if someone reliably runs at the weekend and never
 * on a Tuesday, the fix is to stop scheduling Tuesdays.
 */
export function suggestDays(habit: Habit, completions: CompletionEntry[]): number[] {
  const current =
    habit.frequency.type === 'daily' ? [0, 1, 2, 3, 4, 5, 6] : [...habit.frequency.days].sort((a, b) => a - b);
  const target = Math.max(1, Math.floor(current.length / 2) + (habit.frequency.type === 'daily' ? -1 : 0));
  if (current.length <= 2) return current;

  const kept = new Map<number, number>(current.map((d) => [d, 0]));
  for (const entry of completions) {
    if (entry.habitId !== habit.id) continue;
    const day = new Date(`${entry.date}T00:00:00`).getDay();
    if (kept.has(day)) kept.set(day, (kept.get(day) ?? 0) + 1);
  }

  return [...kept.entries()]
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .slice(0, Math.max(2, target))
    .map(([day]) => day)
    .sort((a, b) => a - b);
}

/**
 * The single suggestion for one struggling quest, or null if it's fine.
 *
 * The order is deliberate: shrink the effort first, because a smaller version
 * of a daily habit beats the same habit three times a week. Only once a quest
 * is already as small as it goes does cutting the frequency come up, and only
 * when it's both tiny and still failing is retiring suggested.
 */
export function suggestFor(
  habit: Habit,
  stat: QuestStat,
  completions: CompletionEntry[],
): Suggestion | null {
  if (habit.archived) return null;
  if (stat.rate === null || stat.due < MIN_OCCURRENCES) return null;
  if (stat.rate >= STRUGGLING_RATE) return null;

  const base = {
    habitId: habit.id,
    name: habit.name,
    rate: stat.rate,
    due: stat.due,
    completed: stat.completed,
  };
  const effort = habit.effort ?? inferEffort(habit.xpReward);
  const smaller = easier(effort);

  if (smaller) {
    return {
      ...base,
      kind: 'easier',
      toEffort: smaller,
      action: `Make it ${EFFORT_TIERS[smaller].label}`,
      rationale: `A ${EFFORT_TIERS[effort].label.toLowerCase()} version isn't landing. A smaller one you actually do beats a bigger one you don't.`,
    };
  }

  const days = suggestDays(habit, completions);
  const currentCount = habit.frequency.type === 'daily' ? 7 : habit.frequency.days.length;
  if (days.length < currentCount) {
    return {
      ...base,
      kind: 'less-often',
      toDays: days,
      action: `Ask for it ${days.length} day${days.length === 1 ? '' : 's'} a week`,
      rationale: "It's already as small as it goes, so the problem is how often it's due — these are the days you've actually been keeping it.",
    };
  }

  return {
    ...base,
    kind: 'retire',
    action: 'Retire this quest',
    rationale: "It's as small and as rare as it gets and still isn't landing. Letting it go is a real answer, not a failure.",
  };
}

/**
 * The one quest most worth mentioning right now, or null.
 *
 * Returns at most one. Six things you're failing is a reason to close the app;
 * one thing with a button next to it is a reason to fix it.
 */
export function getSuggestion(
  habits: Habit[],
  completions: CompletionEntry[],
  snoozed: Record<string, string>,
  today = todayStr(),
  windowDays = RATE_WINDOW_DAYS,
): Suggestion | null {
  const stats = getQuestStats(habits, completions, today, windowDays);
  const byId = new Map(stats.map((s) => [s.habitId, s]));

  let worst: Suggestion | null = null;
  for (const habit of habits) {
    // A dismissal is a decision; respect it until it expires.
    if ((snoozed[habit.id] ?? '') > today) continue;
    const stat = byId.get(habit.id);
    if (!stat) continue;
    const suggestion = suggestFor(habit, stat, completions);
    if (suggestion && (!worst || suggestion.rate < worst.rate)) worst = suggestion;
  }
  return worst;
}

/** When a dismissal of `habitId` should expire. */
export function snoozeUntil(today = todayStr()): string {
  const d = new Date(`${today}T00:00:00`);
  d.setDate(d.getDate() + SNOOZE_DAYS);
  return d.toISOString().slice(0, 10);
}

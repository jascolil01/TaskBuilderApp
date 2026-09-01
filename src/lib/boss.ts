import type { CompletionEntry, Habit } from '../types';
import { addDays, dayOfWeek } from './date';

export interface Boss {
  name: string;
  color: string;
}

export const BOSS_ROSTER: Boss[] = [
  { name: 'Procrastination Wyrm', color: '#9b7fd4' },
  { name: 'The Doubt Golem', color: '#b08d57' },
  { name: 'Sloth Hydra', color: 'var(--color-verdant-500)' },
  { name: 'Burnout Phoenix', color: 'var(--color-blood-500)' },
  { name: 'The Excuse Specter', color: 'var(--color-mana-500)' },
  { name: 'Comfort Zone Dragon', color: '#e07bb0' },
];

/** The Sunday that starts the week containing dateStr (week runs Sun–Sat). */
export function getWeekStart(dateStr: string): string {
  return addDays(dateStr, -dayOfWeek(dateStr));
}

export function getWeekEnd(weekStart: string): string {
  return addDays(weekStart, 6);
}

function weekIndex(weekStart: string): number {
  const [y, m, d] = weekStart.split('-').map(Number);
  const days = Math.floor(Date.UTC(y, m - 1, d) / 86400000);
  return Math.floor(days / 7);
}

export function getBossForWeek(weekStart: string): Boss {
  const idx = ((weekIndex(weekStart) % BOSS_ROSTER.length) + BOSS_ROSTER.length) % BOSS_ROSTER.length;
  return BOSS_ROSTER[idx];
}

/**
 * Scheduled occurrences of `habit` in the week, counted only from the day it
 * existed. A quest added on Friday can only be done twice that week, so
 * charging the boss bar for a full seven days of it would set a target the
 * player cannot reach.
 */
function occurrencesThisWeek(habit: Habit, weekStart: string, away?: ReadonlySet<string>): number {
  const created = habit.createdAt.slice(0, 10);
  const from = created > weekStart ? created : weekStart;
  const weekEnd = getWeekEnd(weekStart);
  if (from > weekEnd) return 0;

  let count = 0;
  for (let cursor = from; cursor <= weekEnd; cursor = addDays(cursor, 1)) {
    if (away?.has(cursor)) continue;
    if (habit.frequency.type === 'daily' || habit.frequency.days.includes(dayOfWeek(cursor))) count += 1;
  }
  return count;
}

export function getWeeklyXpPotential(habits: Habit[], weekStart: string, away?: ReadonlySet<string>): number {
  let total = 0;
  for (const h of habits) {
    if (h.archived) continue;
    total += h.xpReward * occurrencesThisWeek(h, weekStart, away);
  }
  return total;
}

/** The floor before any vacation is taken into account. */
const MIN_THRESHOLD = 50;

export function getBossThreshold(habits: Habit[], weekStart: string): number {
  return Math.max(MIN_THRESHOLD, Math.round(getWeeklyXpPotential(habits, weekStart) * 0.6));
}

/**
 * How much of the week you were actually around for, weighted by what was due
 * on those days — 1 when you were here all week, 0 when a vacation covered
 * every scheduled day of it.
 */
export function getPresentFraction(
  habits: Habit[],
  weekStart: string,
  away: ReadonlySet<string>,
): number {
  const full = getWeeklyXpPotential(habits, weekStart);
  if (full <= 0) return 1;
  return getWeeklyXpPotential(habits, weekStart, away) / full;
}

/**
 * This week's target. The frozen value is a floor, never a ceiling: freezing
 * stops a player archiving a quest mid-week to duck under a bar they'd already
 * missed, but it must not pin a brand-new character to a target set from the
 * three starter quests they had before adding six more.
 */
export function resolveBossThreshold(
  habits: Habit[],
  weekStart: string,
  frozen: { weekStart: string; threshold: number } | null,
  away: ReadonlySet<string> = new Set(),
): number {
  const current = getBossThreshold(habits, weekStart);
  const floor = frozen && frozen.weekStart === weekStart ? Math.max(frozen.threshold, current) : current;

  // A vacation shrinks the target rather than cancelling the week. Blanking
  // the whole week meant two days away silenced the boss for the other five,
  // with the card still claiming you were on holiday. Scaling happens after
  // the frozen floor so a trip can lower a bar that archiving cannot.
  const present = getPresentFraction(habits, weekStart, away);
  if (present <= 0) return 0;
  return Math.round(floor * present);
}

export function getBossGoldReward(threshold: number): number {
  return Math.round(threshold * 0.5);
}

/**
 * Progress toward this week's boss, scored in quest face value.
 *
 * It deliberately does NOT use `xpAwarded`: that figure carries every
 * multiplier the character has earned — the XP perk, Momentum, Berserker, an
 * Elixir — while the threshold is a fraction of the quests' base rewards.
 * Scoring inflated XP against a base-rate target made the boss easier the
 * stronger you got, until a late-game character cleared a "60% of your week"
 * bar doing barely a third of it.
 *
 * Entries written before `baseXp` existed fall back to `xpAwarded`, which is
 * the old, slightly generous behaviour, and only for weeks already past.
 */
export function getWeeklyXpEarned(completions: CompletionEntry[], weekStart: string): number {
  const weekEnd = getWeekEnd(weekStart);
  return completions
    .filter((c) => c.date >= weekStart && c.date <= weekEnd)
    .reduce((sum, c) => sum + (c.baseXp ?? c.xpAwarded), 0);
}

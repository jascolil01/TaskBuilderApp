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

export function getWeeklyXpPotential(habits: Habit[]): number {
  let total = 0;
  for (const h of habits) {
    if (h.archived) continue;
    total += h.frequency.type === 'daily' ? h.xpReward * 7 : h.xpReward * h.frequency.days.length;
  }
  return total;
}

export function getBossThreshold(habits: Habit[]): number {
  return Math.max(50, Math.round(getWeeklyXpPotential(habits) * 0.6));
}

export function getBossGoldReward(threshold: number): number {
  return Math.round(threshold * 0.5);
}

export function getWeeklyXpEarned(completions: CompletionEntry[], weekStart: string): number {
  const weekEnd = getWeekEnd(weekStart);
  return completions
    .filter((c) => c.date >= weekStart && c.date <= weekEnd)
    .reduce((sum, c) => sum + c.xpAwarded, 0);
}

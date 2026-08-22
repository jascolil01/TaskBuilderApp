import type { CompletionEntry } from '../types';
import { addDays, todayStr } from './date';

export interface DailyXp {
  date: string;
  xp: number;
}

export function getDailyXpTotals(completions: CompletionEntry[], days: number): DailyXp[] {
  const today = todayStr();
  const start = addDays(today, -(days - 1));
  const totals = new Map<string, number>();
  for (const c of completions) {
    if (c.date < start || c.date > today) continue;
    totals.set(c.date, (totals.get(c.date) ?? 0) + c.xpAwarded);
  }
  const result: DailyXp[] = [];
  let cursor = start;
  while (cursor <= today) {
    result.push({ date: cursor, xp: totals.get(cursor) ?? 0 });
    cursor = addDays(cursor, 1);
  }
  return result;
}

import type { Vacation } from '../types';
import { addDays, parseDate } from './date';

export const MAX_VACATION_DAYS = 14;
export const MAX_VACATIONS_PER_YEAR = 2;

/** Inclusive day count, so 12–12 Aug is one day and 12–25 Aug is fourteen. */
export function daysInclusive(startDate: string, endDate: string): number {
  const ms = parseDate(endDate).getTime() - parseDate(startDate).getTime();
  return Math.floor(ms / 86400000) + 1;
}

/**
 * The last day a vacation actually covers. Ending one early truncates it
 * rather than deleting it — the trip still happened, and it still counts
 * against the yearly allowance.
 */
export function getEffectiveEnd(vacation: Vacation): string {
  return vacation.endedEarlyOn ?? vacation.endDate;
}

export function isDateInVacation(vacation: Vacation, date: string): boolean {
  return date >= vacation.startDate && date <= getEffectiveEnd(vacation);
}

/** Every day covered by any vacation, for the decay pass to forgive. */
export function getVacationDates(vacations: Vacation[]): string[] {
  const dates: string[] = [];
  for (const vacation of vacations) {
    let cursor = vacation.startDate;
    const end = getEffectiveEnd(vacation);
    // Guard against a corrupted range producing an unbounded loop.
    let guard = 0;
    while (cursor <= end && guard < MAX_VACATION_DAYS * 2) {
      dates.push(cursor);
      cursor = addDays(cursor, 1);
      guard += 1;
    }
  }
  return dates;
}

export function getActiveVacation(vacations: Vacation[], today: string): Vacation | null {
  return vacations.find((v) => isDateInVacation(v, today)) ?? null;
}

export function getUpcomingVacation(vacations: Vacation[], today: string): Vacation | null {
  return (
    [...vacations]
      .filter((v) => v.startDate > today)
      .sort((a, b) => a.startDate.localeCompare(b.startDate))[0] ?? null
  );
}

export function countVacationsInYear(vacations: Vacation[], year: number): number {
  return vacations.filter((v) => Number(v.startDate.slice(0, 4)) === year).length;
}

export function vacationsRemainingThisYear(vacations: Vacation[], today: string): number {
  const year = Number(today.slice(0, 4));
  return Math.max(0, MAX_VACATIONS_PER_YEAR - countVacationsInYear(vacations, year));
}

/** True when any day of the week starting `weekStart` is covered by a vacation. */
export function isWeekOnVacation(vacations: Vacation[], weekStart: string): boolean {
  const weekEnd = addDays(weekStart, 6);
  return vacations.some((v) => v.startDate <= weekEnd && getEffectiveEnd(v) >= weekStart);
}

export type VacationCheck = { ok: true } | { ok: false; error: string };

export function validateVacation(
  vacations: Vacation[],
  startDate: string,
  endDate: string,
  today: string,
): VacationCheck {
  if (!startDate || !endDate) return { ok: false, error: 'Pick both a start and an end date.' };
  if (startDate < today) return { ok: false, error: 'A vacation can only start today or later.' };
  if (endDate < startDate) return { ok: false, error: 'The end date must be on or after the start date.' };

  const days = daysInclusive(startDate, endDate);
  if (days > MAX_VACATION_DAYS) {
    return { ok: false, error: `A vacation can be at most ${MAX_VACATION_DAYS} days — that one is ${days}.` };
  }

  const year = Number(startDate.slice(0, 4));
  if (countVacationsInYear(vacations, year) >= MAX_VACATIONS_PER_YEAR) {
    return { ok: false, error: `You've already used both vacations for ${year}.` };
  }

  const clash = vacations.find((v) => startDate <= getEffectiveEnd(v) && endDate >= v.startDate);
  if (clash) {
    return { ok: false, error: 'That overlaps a vacation you already have scheduled.' };
  }

  return { ok: true };
}

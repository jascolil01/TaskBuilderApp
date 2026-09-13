import type { CheatDayState, Habit, Vacation } from '../types';
import { isScheduledDay } from './rpg';
import { isAwake } from './hibernate';
import { todayStr } from './date';
import { isRestDay } from './forgiveness';

export { isRestDay };

export function getIncompleteTodayCount(
  habits: Habit[],
  cheatDay?: CheatDayState,
  vacations: Vacation[] = [],
): number {
  const today = todayStr();
  // Callers that don't pass the forgiveness state get the raw count, which is
  // what the quest list itself wants.
  if (cheatDay && isRestDay(cheatDay, vacations, today)) return 0;
  return habits.filter(
    (h) => isAwake(h, today) && isScheduledDay(h, today) && h.lastCompletedDate !== today,
  ).length;
}

export function currentTimeHHMM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export async function notifyIncompleteQuests(count: number): Promise<void> {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  const body = count === 1 ? 'You have 1 quest left today.' : `You have ${count} quests left today.`;

  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification('Questlog', { body, icon: '/icon.svg', tag: 'daily-reminder' });
      return;
    } catch {
      // fall through to the plain Notification API below
    }
  }
  new Notification('Questlog', { body, icon: '/icon.svg' });
}

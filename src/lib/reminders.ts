import type { Habit } from '../types';
import { isScheduledDay } from './rpg';
import { todayStr } from './date';

export function getIncompleteTodayCount(habits: Habit[]): number {
  const today = todayStr();
  return habits.filter(
    (h) => !h.archived && isScheduledDay(h, today) && h.lastCompletedDate !== today,
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

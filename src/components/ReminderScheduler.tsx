import { useEffect } from 'react';
import { useStore } from '../store';
import { currentTimeHHMM, getIncompleteTodayCount, notifyIncompleteQuests } from '../lib/reminders';
import { todayStr } from '../lib/date';

// Best-effort: only fires while this tab/PWA is open and its JS timers are
// actively running. There is no server to push notifications when the app
// is fully closed, so this checks the clock every 30s while alive.
export function ReminderScheduler() {
  const settings = useStore((s) => s.settings);
  const habits = useStore((s) => s.habits);
  const markReminderNotified = useStore((s) => s.markReminderNotified);

  useEffect(() => {
    if (!settings.enabled) return;

    const check = () => {
      const today = todayStr();
      if (settings.lastNotifiedDate === today) return;
      if (currentTimeHHMM() !== settings.time) return;

      const count = getIncompleteTodayCount(habits);
      if (count > 0) notifyIncompleteQuests(count);
      markReminderNotified(today);
    };

    check();
    const interval = setInterval(check, 30_000);
    return () => clearInterval(interval);
  }, [settings.enabled, settings.time, settings.lastNotifiedDate, habits, markReminderNotified]);

  return null;
}

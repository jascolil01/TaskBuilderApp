import { useEffect } from 'react';
import { useStore } from '../store';
import { currentTimeHHMM, getIncompleteTodayCount, notifyIncompleteQuests } from '../lib/reminders';
import { todayStr } from '../lib/date';

// Best-effort: only fires while this tab/PWA is open and its JS timers are
// actively running. There is no server to push notifications when the app
// is fully closed, so this checks the clock every 30s while alive.
export function ReminderScheduler() {
  const enabled = useStore((s) => s.settings.enabled);
  const time = useStore((s) => s.settings.time);

  useEffect(() => {
    if (!enabled) return;

    const check = () => {
      // Read fresh each tick rather than closing over state, so the interval
      // isn't torn down and restarted every time a quest changes.
      const { settings, habits, character, vacations, markReminderNotified } = useStore.getState();
      if (!settings.enabled) return;

      const today = todayStr();
      if (settings.lastNotifiedDate === today) return;
      // Fire at or after the chosen time. Requiring an exact HH:MM match gave
      // a one-minute window per day, so opening the app at 19:05 for a 19:00
      // reminder meant it silently never fired.
      if (currentTimeHHMM() < settings.time) return;

      const count = getIncompleteTodayCount(habits, character.cheatDay, vacations);
      if (count > 0) notifyIncompleteQuests(count);
      markReminderNotified(today);
    };

    check();
    const interval = setInterval(check, 30_000);
    return () => clearInterval(interval);
  }, [enabled, time]);

  return null;
}

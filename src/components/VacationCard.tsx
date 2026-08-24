import { useStore } from '../store';
import { todayStr } from '../lib/date';
import { daysInclusive, getActiveVacation, getEffectiveEnd, getUpcomingVacation } from '../lib/vacation';

/** Only rendered when a vacation is running or coming up. */
export function VacationCard() {
  const vacations = useStore((s) => s.vacations);
  const endVacationEarly = useStore((s) => s.endVacationEarly);

  const today = todayStr();
  const active = getActiveVacation(vacations, today);
  const upcoming = active ? null : getUpcomingVacation(vacations, today);
  if (!active && !upcoming) return null;

  // Coming back early still leaves today covered — the toast promises quests
  // resume tomorrow — but "On vacation, 1 day left" would read as if the
  // button hadn't worked.
  if (active?.endedEarlyOn) {
    return (
      <div className="rounded-xl border border-white/15 bg-ink-800/50 px-4 py-3">
        <p className="text-sm text-white/70">
          🏠 Welcome back <span className="text-white/40">— today is still covered; quests resume tomorrow.</span>
        </p>
      </div>
    );
  }

  if (active) {
    const end = getEffectiveEnd(active);
    const left = daysInclusive(today, end);
    return (
      <div className="rounded-xl border border-mana-500/50 bg-mana-500/10 p-3.5">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🏝️</span>
          <div className="min-w-0 flex-1">
            <p className="font-display font-semibold text-mana-400">On vacation</p>
            <p className="mt-0.5 text-[11px] text-white/50">
              Streaks are safe until {end} · {left} day{left === 1 ? '' : 's'} left. Quests still pay XP if you
              feel like it.
            </p>
          </div>
          <button
            onClick={endVacationEarly}
            className="shrink-0 rounded-full border border-mana-400/60 px-3 py-1.5 text-xs font-semibold text-mana-400 active:scale-95"
          >
            I'm back
          </button>
        </div>
      </div>
    );
  }

  const days = daysInclusive(upcoming!.startDate, upcoming!.endDate);
  return (
    <div className="rounded-xl border border-white/15 bg-ink-800/50 px-4 py-3">
      <p className="text-sm text-white/70">
        🏝️ Vacation booked for {upcoming!.startDate} → {upcoming!.endDate}{' '}
        <span className="text-white/40">({days} days)</span>
      </p>
    </div>
  );
}

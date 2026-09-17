import { useMemo, useState } from 'react';
import { useStore } from '../store';
import type { Habit } from '../types';
import { HabitCard } from '../components/HabitCard';
import { todayStr } from '../lib/date';
import { getIncompleteTodayCount, isRestDay } from '../lib/reminders';
import { getActiveVacation } from '../lib/vacation';
import { isScheduledDay } from '../lib/rpg';
import { AddEditHabit } from './AddEditHabit';
import { QuestBrowser } from './QuestBrowser';
import { Goals } from './Goals';
import { CoachCard } from '../components/CoachCard';
import { daysUntilWake, isAwake, isHibernating } from '../lib/hibernate';
import { getGoalStatus } from '../lib/goals';
import { formatWeekRange, reviewDue } from '../lib/review';
import { WeekReview } from './WeekReview';

export function QuestLog() {
  const habits = useStore((s) => s.habits);
  const [editing, setEditing] = useState<Habit | 'new' | null>(null);
  const [browsing, setBrowsing] = useState(false);

  // A sleeping quest is neither active nor archived: it gets its own section
  // so it's visibly waiting rather than appearing to have been dropped.
  const active = habits.filter((h) => isAwake(h));
  const sleeping = habits.filter((h) => !h.archived && isHibernating(h));
  const archived = habits.filter((h) => h.archived);
  const today = todayStr();
  const cheatDay = useStore((s) => s.character.cheatDay);
  const vacations = useStore((s) => s.vacations);
  const restDay = useMemo(() => isRestDay(cheatDay, vacations), [cheatDay, vacations]);
  const onVacation = useMemo(() => getActiveVacation(vacations, todayStr()) !== null, [vacations]);
  const incompleteCount = useMemo(
    () => getIncompleteTodayCount(active, cheatDay, vacations),
    [active, cheatDay, vacations],
  );

  const byDoneThenName = (a: Habit, b: Habit) => {
    const aDone = a.lastCompletedDate === today ? 1 : 0;
    const bDone = b.lastCompletedDate === today ? 1 : 0;
    if (aDone !== bDone) return aDone - bDone;
    return a.name.localeCompare(b.name);
  };

  // Quests due today drive the main list; the rest are still reachable but
  // set apart, so the list agrees with the "quests left today" count.
  const dueToday = useMemo(
    () => active.filter((h) => isScheduledDay(h, today)).sort(byDoneThenName),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [active, today],
  );
  const offSchedule = useMemo(
    () => active.filter((h) => !isScheduledDay(h, today)).sort(byDoneThenName),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [active, today],
  );

  const goals = useStore((s) => s.goals);
  const [goalsOpen, setGoalsOpen] = useState(false);
  // Only goals still in play get a badge; a finished one is not something
  // you still owe.
  const activeGoals = goals.filter((g) => getGoalStatus(g) === 'active').length;

  // Offered rather than forced. A modal thrown at you the moment you open the
  // app on a Sunday is a modal you learn to dismiss without reading, and the
  // one thing this screen cannot afford is to become furniture.
  const lastReviewedWeek = useStore((s) => s.settings.lastReviewedWeek);
  const markWeekReviewed = useStore((s) => s.markWeekReviewed);
  const [reviewOpen, setReviewOpen] = useState(false);
  const owedWeek = useMemo(() => reviewDue(today, lastReviewedWeek), [today, lastReviewedWeek]);
  // Nothing to look back on yet: a character a week old has no week to review,
  // and an empty one reads as the app being broken rather than as a new start.
  const hasHistory = habits.length > 0;

  return (
    <div className="flex flex-col gap-4 px-4 pb-28 pt-6">
      <div className="flex items-center justify-between gap-2">
        <h1 className="shrink-0 whitespace-nowrap font-display text-xl font-bold text-gold-300">Quest Log</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setGoalsOpen(true)}
            className="relative shrink-0 rounded-full border border-white/20 px-2.5 py-1.5 text-[13px] font-medium text-white/65 active:scale-95"
          >
            🎯 Goals
            {activeGoals > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold-500 px-1 text-[10px] font-bold text-ink-950">
                {activeGoals}
              </span>
            )}
          </button>
          <button
            onClick={() => setBrowsing(true)}
            className="shrink-0 rounded-full border border-white/20 px-2.5 py-1.5 text-[13px] font-medium text-white/65 active:scale-95"
          >
            💡 Ideas
          </button>
          <button
            onClick={() => setEditing('new')}
            className="shrink-0 rounded-full border border-gold-500/60 bg-gold-500/10 px-3 py-1.5 text-[13px] font-medium text-gold-300 active:scale-95"
          >
            + New
          </button>
        </div>
      </div>

      {restDay ? (
        <div className="rounded-xl border border-mana-500/40 bg-mana-500/10 px-4 py-2.5 text-sm text-mana-400">
          {onVacation ? '🏝️ On vacation — nothing is due today.' : '🍰 Rest day — every quest is forgiven today.'}{' '}
          <span className="text-white/45">Streaks are safe either way.</span>
        </div>
      ) : (
        incompleteCount > 0 && (
          <div className="rounded-xl border border-gold-500/40 bg-gold-500/10 px-4 py-2.5 text-sm text-gold-300">
            🔔 {incompleteCount} quest{incompleteCount > 1 ? 's' : ''} left today
          </div>
        )
      )}

      {owedWeek && hasHistory && (
        <div className="flex items-center gap-2 rounded-xl border border-gold-500/30 bg-gold-500/[0.07] px-3 py-2.5">
          <button onClick={() => setReviewOpen(true)} className="min-w-0 flex-1 text-left">
            <p className="text-sm text-gold-300">📜 Your week, {formatWeekRange(owedWeek)}</p>
            <p className="mt-0.5 text-[11px] text-white/40">How the last seven days actually went.</p>
          </button>
          <button
            onClick={() => markWeekReviewed(owedWeek)}
            aria-label="Skip this week's review"
            className="shrink-0 px-2 text-white/25"
          >
            ✕
          </button>
        </div>
      )}

      {/* Below the day's status, above the list: seen on the way to the
          quests rather than instead of them. */}
      <CoachCard />

      {active.length === 0 ? (
        <div className="parchment-border mt-4 rounded-2xl bg-ink-800/50 p-6 text-center text-white/60">
          <p className="text-3xl">📜</p>
          <p className="mt-2 font-display text-gold-300">Your quest log is empty</p>
          <p className="mt-1 text-sm">Not sure where to start? Browse ready-made quests, already set up.</p>
          <button
            onClick={() => setBrowsing(true)}
            className="mt-4 rounded-full bg-gold-500 px-5 py-2 text-sm font-semibold text-ink-950 active:scale-95"
          >
            💡 Browse quest ideas
          </button>
        </div>
      ) : (
        <>
          {dueToday.length > 0 && (
            <div className="flex flex-col gap-2.5">
              {dueToday.map((h) => (
                <HabitCard key={h.id} habit={h} onEdit={setEditing} />
              ))}
            </div>
          )}

          {dueToday.length === 0 && (
            <div className="parchment-border rounded-2xl bg-ink-800/50 p-6 text-center text-white/60">
              <p className="text-3xl">🌙</p>
              <p className="mt-2 font-display text-gold-300">Nothing scheduled today</p>
              <p className="mt-1 text-sm">Enjoy the rest — or take on an off-day quest below.</p>
            </div>
          )}

          {offSchedule.length > 0 && (
            <div className="mt-2">
              <h2 className="font-display text-sm uppercase tracking-widest text-white/40">Not scheduled today</h2>
              <p className="mb-2 mt-0.5 text-[11px] text-white/30">
                Still earns XP and gold, but won't build a streak.
              </p>
              <div className="flex flex-col gap-2.5 opacity-70">
                {offSchedule.map((h) => (
                  <HabitCard key={h.id} habit={h} onEdit={setEditing} offSchedule />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {sleeping.length > 0 && (
        <details className="mt-2 text-white/50">
          <summary className="cursor-pointer text-sm">😴 Sleeping ({sleeping.length})</summary>
          <div className="mt-2 flex flex-col gap-2.5">
            {sleeping.map((h) => (
              <div key={h.id} className="rounded-xl border border-white/10 bg-ink-800/30 p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm text-white/70">{h.name}</span>
                  <span className="shrink-0 text-[11px] text-white/35">
                    wakes in {daysUntilWake(h)}d
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-white/35">
                  🔥 {h.streak} day streak, held
                </p>
                <button
                  onClick={() => setEditing(h)}
                  className="mt-2 w-full rounded-lg border border-white/12 py-1.5 text-[11px] text-white/45"
                >
                  Wake it early
                </button>
              </div>
            ))}
          </div>
        </details>
      )}

      {archived.length > 0 && (
        <details className="mt-2 text-white/50">
          <summary className="cursor-pointer text-sm">Archived quests ({archived.length})</summary>
          <div className="mt-2 flex flex-col gap-2.5">
            {archived.map((h) => (
              <HabitCard key={h.id} habit={h} onEdit={setEditing} />
            ))}
          </div>
        </details>
      )}

      {editing && <AddEditHabit habit={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      {browsing && <QuestBrowser onClose={() => setBrowsing(false)} />}
      {goalsOpen && <Goals onClose={() => setGoalsOpen(false)} />}
      {reviewOpen && owedWeek && (
        <WeekReview weekStart={owedWeek} onClose={() => setReviewOpen(false)} />
      )}
    </div>
  );
}

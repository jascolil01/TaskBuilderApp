import { useStore } from '../store';
import type { Habit } from '../types';
import { ATTRIBUTE_INFO, isAtRisk, isDecaying } from '../lib/rpg';
import { todayStr, weekdayLabel } from '../lib/date';

export function HabitCard({ habit, onEdit }: { habit: Habit; onEdit: (habit: Habit) => void }) {
  const completeHabit = useStore((s) => s.completeHabit);
  const undoCompleteHabit = useStore((s) => s.undoCompleteHabit);
  const info = ATTRIBUTE_INFO[habit.attribute];
  const doneToday = habit.lastCompletedDate === todayStr();
  const decaying = isDecaying(habit);
  const atRisk = isAtRisk(habit);

  const scheduleLabel =
    habit.frequency.type === 'daily'
      ? 'Daily'
      : habit.frequency.days.length === 0
        ? 'Never'
        : habit.frequency.days
            .slice()
            .sort((a, b) => a - b)
            .map(weekdayLabel)
            .join(' · ');

  return (
    <div
      className={`parchment-border rounded-xl bg-ink-800/50 p-3.5 transition-colors ${
        decaying ? 'border-blood-500/60' : atRisk ? 'border-gold-500/60' : ''
      }`}
    >
      <div className="flex items-start gap-3">
        <button
          onClick={() => (doneToday ? undoCompleteHabit(habit.id) : completeHabit(habit.id))}
          aria-label={doneToday ? 'Undo completion' : 'Mark complete'}
          className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-lg transition-all active:scale-90 ${
            doneToday
              ? 'border-verdant-500 bg-verdant-500/25 text-verdant-400'
              : 'border-white/25 text-white/30 hover:border-gold-400/70 hover:text-gold-300'
          }`}
        >
          {doneToday ? '✓' : ''}
        </button>

        <button className="flex-1 text-left" onClick={() => onEdit(habit)}>
          <div className="flex items-center justify-between gap-2">
            <span className={`font-medium ${doneToday ? 'text-white/50 line-through' : 'text-white/90'}`}>
              {habit.name}
            </span>
            <span className="shrink-0 text-xs font-display" style={{ color: info.color }}>
              +{habit.xpReward} {habit.attribute}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-white/40">
            <span>{scheduleLabel}</span>
            {habit.streak > 0 && <span className="text-gold-400/90">🔥 {habit.streak} day streak</span>}
            {decaying && <span className="text-blood-400">⚠ decaying ({habit.missedSinceCompletion}d missed)</span>}
            {!decaying && atRisk && (
              <span className="text-gold-400/90">
                ⏳ {habit.graceDays - habit.missedSinceCompletion + 1} day(s) left before decay
              </span>
            )}
          </div>
        </button>
      </div>
    </div>
  );
}

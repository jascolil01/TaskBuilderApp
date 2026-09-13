import { useState } from 'react';
import { useStore } from '../store';
import type { Habit } from '../types';
import { ATTRIBUTE_INFO, isAtRisk, isDecaying, isScheduledDay } from '../lib/rpg';
import { getEffortGold, inferEffort } from '../lib/effort';
import {
  daysToNextTier,
  effectiveTier,
  getStreakBonus,
  getTierName,
  nextTier,
  tierForStreak,
} from '../lib/streak';
import { getSecondaryXp, resolveSecondary } from '../lib/affinity';
import { addDays, todayStr, weekdayLabel } from '../lib/date';

export function HabitCard({
  habit,
  onEdit,
  offSchedule = false,
}: {
  habit: Habit;
  onEdit: (habit: Habit) => void;
  offSchedule?: boolean;
}) {
  const completeHabit = useStore((s) => s.completeHabit);
  const undoCompleteHabit = useStore((s) => s.undoCompleteHabit);
  const backfillYesterday = useStore((s) => s.backfillYesterday);
  const completions = useStore((s) => s.completions);
  const setCompletionNote = useStore((s) => s.setCompletionNote);
  const [noteOpen, setNoteOpen] = useState(false);
  const info = ATTRIBUTE_INFO[habit.attribute];
  const doneToday = habit.lastCompletedDate === todayStr();
  const attributes = useStore((s) => s.character.attributes);
  const decaying = isDecaying(habit, attributes);
  const atRisk = isAtRisk(habit, attributes);

  // The reward side of consistency. A tier can outlive the streak that earned
  // it — a break steps it down rather than clearing it — so this is read from
  // the held tier, not from the streak alone.
  const tier = effectiveTier(habit.bonusTier, habit.streak);
  const tierPct = Math.round(getStreakBonus(tier) * 100);
  const toNext = daysToNextTier(habit.bonusTier, habit.streak);
  const upcoming = nextTier(tier);
  // The rung is carried over from a run that has since broken, rather than
  // earned by the streak showing right now.
  const held = tier > tierForStreak(habit.streak);

  // What the side attribute earns, shown at the quest's face value — the same
  // basis the primary figure beside it uses.
  const secondary = resolveSecondary(habit.attribute, habit.secondary);
  const secondaryXp = getSecondaryXp(habit.xpReward, secondary !== null);

  // The note belongs to the day, so it's only offered once the day is logged.
  const todayEntry = completions.find((c) => c.habitId === habit.id && c.date === todayStr());
  const note = todayEntry?.note ?? '';

  // Backfill is offered only where it makes sense: a scheduled day, one day
  // back, that the quest existed for and has no completion yet.
  const yesterday = addDays(todayStr(), -1);
  const yesterdayEntry = completions.find((c) => c.habitId === habit.id && c.date === yesterday);
  const canBackfill =
    !habit.archived &&
    isScheduledDay(habit, yesterday) &&
    yesterday >= habit.createdAt.slice(0, 10) &&
    !yesterdayEntry;
  // A backfill used to be permanent; it can be taken back the same way.
  const undoBackfill = yesterdayEntry?.backfilled === true;

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
            <span className="shrink-0 text-right text-xs font-display" style={{ color: info.color }}>
              +{habit.xpReward} {habit.attribute}
              {secondary && (
                <span className="ml-1 opacity-60" style={{ color: ATTRIBUTE_INFO[secondary].color }}>
                  +{secondaryXp} {secondary}
                </span>
              )}
              <span className="ml-1.5 text-gold-400/80">🪙{getEffortGold(habit.effort ?? inferEffort(habit.xpReward))}</span>
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-white/40">
            <span>{scheduleLabel}</span>
            {offSchedule && <span className="text-white/35">no streak credit</span>}
            {habit.streak > 0 && <span className="text-gold-400/90">🔥 {habit.streak} day streak</span>}
            {tier > 0 && (
              <span className="text-mana-300/90">
                ⚡ {getTierName(tier)} +{tierPct}% XP
                {/* Without this, a bonus sitting on a zeroed streak looks like a bug. */}
                {held && <span className="text-white/35"> (held)</span>}
              </span>
            )}
            {toNext !== null && upcoming && (
              <span className="text-white/30">
                {toNext}d to {upcoming.name}
              </span>
            )}
            {decaying && <span className="text-blood-400">⚠ decaying ({habit.missedSinceCompletion}d missed)</span>}
            {!decaying && atRisk && (
              <span className="text-gold-400/90">
                ⏳ {habit.graceDays - habit.missedSinceCompletion + 1} day(s) left before decay
              </span>
            )}
          </div>
        </button>
      </div>

      {canBackfill && (
        <button
          onClick={() => backfillYesterday(habit.id)}
          className="mt-2 w-full rounded-lg border border-white/12 py-1.5 text-[11px] text-white/45 active:scale-[0.98]"
        >
          📜 I did this yesterday
        </button>
      )}

      {undoBackfill && (
        <button
          onClick={() => undoCompleteHabit(habit.id, yesterday)}
          className="mt-2 w-full rounded-lg border border-white/12 py-1.5 text-[11px] text-white/35 active:scale-[0.98]"
        >
          📜 Logged for yesterday · Undo
        </button>
      )}

      {/* Only once today is logged: a note is about how it went, which you
          can't say yet. Never prompted — an optional line you're made to fill
          in is a line you stop filling in. */}
      {doneToday &&
        (noteOpen ? (
          <input
            autoFocus
            defaultValue={note}
            maxLength={140}
            placeholder="How did it go?"
            onBlur={(e) => {
              setCompletionNote(habit.id, todayStr(), e.target.value);
              setNoteOpen(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
              if (e.key === 'Escape') setNoteOpen(false);
            }}
            className="mt-2 w-full rounded-lg border border-white/15 bg-ink-950/60 px-3 py-1.5 text-[12px] text-white/80 placeholder:text-white/25 focus:border-gold-500/50 focus:outline-none"
          />
        ) : (
          <button
            onClick={() => setNoteOpen(true)}
            className="mt-2 w-full rounded-lg border border-white/10 px-3 py-1.5 text-left text-[11px] text-white/35 active:scale-[0.98]"
          >
            {note ? <span className="italic text-white/55">&ldquo;{note}&rdquo;</span> : '✎ Add a note'}
          </button>
        ))}
    </div>
  );
}

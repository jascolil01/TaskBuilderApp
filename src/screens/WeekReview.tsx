import { useMemo } from 'react';
import { useStore } from '../store';
import { ATTRIBUTE_INFO } from '../lib/rpg';
import { formatWeekRange, getWeekReview } from '../lib/review';

/**
 * The week that just ended, once.
 *
 * Drawn as a page rather than a dashboard: a headline, then the things that
 * happened, in the order you would want to hear them. The quests you kept come
 * before the ones you didn't, and the ones you didn't are a number with no
 * adjective attached — the coach is the app's voice for a quest that genuinely
 * isn't working, and it stays a separate, rarer one.
 */
export function WeekReview({ weekStart, onClose }: { weekStart: string; onClose: () => void }) {
  const habits = useStore((s) => s.habits);
  const completions = useStore((s) => s.completions);
  const goals = useStore((s) => s.goals);
  const bossVictories = useStore((s) => s.bossVictories);
  const vacations = useStore((s) => s.vacations);
  const markWeekReviewed = useStore((s) => s.markWeekReviewed);

  const review = useMemo(
    () => getWeekReview(weekStart, habits, completions, goals, bossVictories, vacations),
    [weekStart, habits, completions, goals, bossVictories, vacations],
  );

  const close = () => {
    markWeekReviewed(weekStart);
    onClose();
  };

  const kept = review.quests.filter((q) => q.perfect);
  const rest = review.quests.filter((q) => !q.perfect);
  const better =
    review.previous?.rate != null && review.rate != null ? review.rate - review.previous.rate : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm">
      <div className="max-h-[92dvh] w-full max-w-[560px] overflow-y-auto rounded-t-3xl border-t border-gold-500/40 bg-ink-900 p-5 pb-8">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />

        <p className="text-[11px] uppercase tracking-wide text-white/35">
          Your week · {formatWeekRange(weekStart)}
        </p>
        <h2 className="mt-1 font-display text-xl font-bold leading-snug text-gold-300">
          {review.headline}
        </h2>

        {review.onVacation && (
          <p className="mt-2 rounded-lg border border-white/10 bg-ink-800/40 px-3 py-2 text-[11px] text-white/45">
            🏝️ You were away for part of this week, so anything missed was forgiven at the time.
          </p>
        )}

        <div className="mt-4 grid grid-cols-3 gap-2">
          {[
            { label: 'Quests kept', value: review.due > 0 ? `${review.kept}/${review.due}` : '—' },
            { label: 'XP earned', value: review.xp.toLocaleString() },
            { label: 'Days active', value: `${review.activeDays}/7` },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl border border-white/10 bg-ink-800/40 p-2.5 text-center">
              <p className="font-display text-lg text-white/90 tabular-nums">{stat.value}</p>
              <p className="mt-0.5 text-[10px] leading-tight text-white/35">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Only shown when there is a real comparison to make. A first week has
            nothing to be better or worse than, and inventing one is noise. */}
        {better !== null && better !== 0 && (
          <p className="mt-2 text-center text-[11px] text-white/40">
            {better > 0 ? '↑' : '↓'} {Math.abs(better)} points {better > 0 ? 'up on' : 'down from'} the week
            before ({review.previous!.rate}%)
          </p>
        )}

        {review.boss && (
          <div className="mt-4 rounded-xl border border-gold-500/30 bg-gold-500/[0.07] p-3">
            <p className="text-sm text-gold-300">⚔️ {review.boss.name} defeated</p>
            <p className="mt-0.5 text-[11px] text-white/40">Paid 🪙{review.boss.goldReward}</p>
          </div>
        )}

        {review.goals.length > 0 && (
          <div className="mt-4">
            <h3 className="font-display text-xs uppercase tracking-wide text-white/40">Goals</h3>
            <div className="mt-1.5 flex flex-col gap-1.5">
              {review.goals.map((goal) => (
                <div key={goal.id} className="flex items-baseline gap-2 text-[12px]">
                  <span className="min-w-0 flex-1 truncate text-white/70">
                    {goal.finished && '🏆 '}
                    {goal.name}
                  </span>
                  <span className="shrink-0 tabular-nums text-white/40">
                    {goal.gained > 0 && `+${goal.gained} · `}
                    {goal.progress}/{goal.target}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {kept.length > 0 && (
          <div className="mt-4">
            <h3 className="font-display text-xs uppercase tracking-wide text-verdant-400/70">
              Kept every time
            </h3>
            <div className="mt-1.5 flex flex-col gap-1.5">
              {kept.map((quest) => (
                <div key={quest.habitId} className="flex items-baseline gap-2 text-[12px]">
                  <span className="shrink-0" style={{ color: ATTRIBUTE_INFO[quest.attribute].color }}>
                    ●
                  </span>
                  <span className="min-w-0 flex-1 truncate text-white/80">{quest.name}</span>
                  <span className="shrink-0 tabular-nums text-verdant-400/80">
                    {quest.due}/{quest.due}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {rest.length > 0 && (
          <div className="mt-4">
            {/* "The rest", not "missed" or "failed". The numbers say what
                happened; the heading does not need to editorialise. */}
            <h3 className="font-display text-xs uppercase tracking-wide text-white/40">The rest</h3>
            <div className="mt-1.5 flex flex-col gap-1.5">
              {rest.map((quest) => (
                <div key={quest.habitId} className="flex items-baseline gap-2 text-[12px]">
                  <span className="shrink-0 opacity-40" style={{ color: ATTRIBUTE_INFO[quest.attribute].color }}>
                    ●
                  </span>
                  <span className="min-w-0 flex-1 truncate text-white/55">{quest.name}</span>
                  <span className="shrink-0 tabular-nums text-white/35">
                    {Math.min(quest.kept, quest.due)}/{quest.due}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {review.streaks.length > 0 && (
          <div className="mt-4">
            <h3 className="font-display text-xs uppercase tracking-wide text-white/40">Still running</h3>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {review.streaks.map((streak) => (
                <span
                  key={streak.name}
                  className="rounded-full border border-white/12 px-2.5 py-1 text-[11px] text-white/55"
                >
                  🔥 {streak.name} · {streak.streak}d
                </span>
              ))}
            </div>
          </div>
        )}

        {/* The part of a week you forget fastest, and the only part nothing
            else in the app brings back to you. */}
        {review.notes.length > 0 && (
          <div className="mt-4">
            <h3 className="font-display text-xs uppercase tracking-wide text-white/40">What you said</h3>
            <div className="mt-1.5 flex flex-col gap-2">
              {review.notes.map((note, i) => (
                <div key={`${note.date}-${i}`} className="rounded-lg border border-white/8 bg-ink-800/30 px-3 py-2">
                  <p className="text-[12px] italic leading-relaxed text-white/65">&ldquo;{note.note}&rdquo;</p>
                  <p className="mt-0.5 text-[10px] text-white/30">{note.habitName}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={close}
          className="mt-6 w-full rounded-xl border border-gold-500/50 bg-gold-500/10 py-2.5 text-sm font-medium text-gold-300 active:scale-[0.98]"
        >
          On to this week
        </button>
      </div>
    </div>
  );
}

import { useMemo, useState } from 'react';
import { useStore } from '../store';
import type { AttributeKey } from '../types';
import { ATTRIBUTE_INFO, ATTRIBUTE_KEYS } from '../lib/rpg';
import {
  GOAL_GOLD,
  GOAL_SCALE_LABEL,
  GOAL_TEMPLATES,
  GOAL_XP,
  getGoalPace,
  paceLabel,
} from '../lib/goals';
import { todayStr } from '../lib/date';

/**
 * Goals, kept visually apart from quests on purpose. A quest is a question you
 * answer every day; a goal is a distance you are covering, so it is drawn as a
 * bar rather than a checkbox, and the thing it reports is pace rather than a
 * streak.
 */
export function Goals({ onClose }: { onClose: () => void }) {
  const goals = useStore((s) => s.goals);
  const setGoalProgress = useStore((s) => s.setGoalProgress);
  const deleteGoal = useStore((s) => s.deleteGoal);
  const addGoalFromTemplate = useStore((s) => s.addGoalFromTemplate);
  const today = todayStr();

  const [browsing, setBrowsing] = useState(goals.length === 0);
  const [filter, setFilter] = useState<AttributeKey | 'all'>('all');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const owned = useMemo(
    () => new Set(goals.map((g) => g.name.trim().toLowerCase())),
    [goals],
  );
  const visible = useMemo(
    () => (filter === 'all' ? GOAL_TEMPLATES : GOAL_TEMPLATES.filter((t) => t.attribute === filter)),
    [filter],
  );

  // Finished and expired goals sink below the ones still in play.
  const sorted = useMemo(() => {
    const rank = (s: string) => (s === 'active' ? 0 : s === 'complete' ? 1 : 2);
    return [...goals].sort(
      (a, b) => rank(getGoalPace(a, today).status) - rank(getGoalPace(b, today).status),
    );
  }, [goals, today]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
      <div className="max-h-[92dvh] w-full max-w-[560px] overflow-y-auto rounded-t-3xl border-t border-gold-500/40 bg-ink-900 p-5 pb-8">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />

        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-bold text-gold-300">Goals</h2>
          <button
            onClick={() => setBrowsing((v) => !v)}
            className="rounded-full border border-gold-500/50 px-3 py-1 text-xs text-gold-300"
          >
            {browsing ? 'My goals' : '+ Take one on'}
          </button>
        </div>
        <p className="mt-1 text-[11px] text-white/40">
          Something with a finish line. Goals don't decay and don't count toward the weekly boss — they pay out once,
          when you get there.
        </p>

        {browsing ? (
          <>
            <div className="mt-4 flex flex-wrap gap-1.5">
              <button
                onClick={() => setFilter('all')}
                className={`rounded-full px-2.5 py-1 text-[11px] ${
                  filter === 'all' ? 'bg-gold-500/20 text-gold-300' : 'border border-white/15 text-white/50'
                }`}
              >
                All
              </button>
              {ATTRIBUTE_KEYS.map((key) => (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  className={`rounded-full px-2.5 py-1 text-[11px] ${
                    filter === key ? 'text-ink-950' : 'border border-white/15 text-white/50'
                  }`}
                  style={filter === key ? { background: ATTRIBUTE_INFO[key].color } : undefined}
                >
                  {ATTRIBUTE_INFO[key].label}
                </button>
              ))}
            </div>

            <div className="mt-3 flex flex-col gap-2.5">
              {visible.map((t) => {
                const already = owned.has(t.name.trim().toLowerCase());
                return (
                  <div key={t.id} className="rounded-xl border border-white/10 bg-ink-800/40 p-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="min-w-0 flex-1 text-sm text-white/85">{t.name}</span>
                      <span
                        className="shrink-0 font-display text-[11px]"
                        style={{ color: ATTRIBUTE_INFO[t.attribute].color }}
                      >
                        {t.attribute}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-white/40">{t.note}</p>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="text-[11px] text-white/35">
                        {t.target} {t.unit} · {t.days} days · {GOAL_SCALE_LABEL[t.scale]}
                        <span className="ml-1.5 text-gold-400/70">
                          +{GOAL_XP[t.scale]} XP · 🪙{GOAL_GOLD[t.scale]}
                        </span>
                      </span>
                      <button
                        disabled={already}
                        onClick={() => addGoalFromTemplate(t.id)}
                        className={`shrink-0 rounded-lg px-3 py-1 text-[11px] font-medium ${
                          already
                            ? 'border border-white/10 text-white/25'
                            : 'border border-gold-500/50 text-gold-300 active:scale-95'
                        }`}
                      >
                        {already ? 'Taken' : 'Take on'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : sorted.length === 0 ? (
          <p className="mt-6 text-center text-xs text-white/35">
            No goals yet. Take one on and it'll sit here with a bar to fill.
          </p>
        ) : (
          <div className="mt-4 flex flex-col gap-3">
            {sorted.map((goal) => {
              const pace = getGoalPace(goal, today);
              const info = ATTRIBUTE_INFO[goal.attribute];
              const done = pace.status === 'complete';
              const expired = pace.status === 'expired';
              return (
                <div
                  key={goal.id}
                  className={`rounded-xl border p-3.5 ${
                    done
                      ? 'border-verdant-500/40 bg-verdant-500/5'
                      : expired
                        ? 'border-white/10 bg-ink-800/20 opacity-60'
                        : 'border-white/12 bg-ink-800/40'
                  }`}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="min-w-0 flex-1 text-sm text-white/90">
                      {done && '🏆 '}
                      {goal.name}
                    </span>
                    <span className="shrink-0 font-display text-[11px]" style={{ color: info.color }}>
                      {goal.attribute}
                    </span>
                  </div>

                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/8">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${pace.pct}%`,
                        background: done ? 'var(--color-verdant-500)' : info.color,
                      }}
                    />
                  </div>

                  <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px]">
                    <span className="text-white/50 tabular-nums">
                      {goal.progress} / {goal.target} {goal.unit}
                    </span>
                    <span
                      className={
                        done
                          ? 'text-verdant-400'
                          : expired
                            ? 'text-white/30'
                            : pace.onPace
                              ? 'text-white/40'
                              : 'text-gold-400/90'
                      }
                    >
                      {pace.status === 'active' && `${pace.daysLeft}d left · `}
                      {paceLabel(pace)}
                    </span>
                  </div>

                  {/* Still tickable past the deadline: finishing late is
                      still finishing, it just doesn't pay. Hiding the control
                      would make that outcome unreachable. */}
                  {!done && (
                    <div className="mt-2.5 flex gap-2">
                      <button
                        onClick={() => setGoalProgress(goal.id, goal.progress - 1)}
                        disabled={goal.progress === 0}
                        aria-label={`Remove one from ${goal.name}`}
                        className="w-12 rounded-lg border border-white/12 py-1.5 text-sm text-white/40 disabled:opacity-30 active:scale-95"
                      >
                        −
                      </button>
                      <button
                        onClick={() => setGoalProgress(goal.id, goal.progress + 1)}
                        aria-label={`Add one to ${goal.name}`}
                        className="flex-1 rounded-lg border border-gold-500/45 py-1.5 text-xs font-medium text-gold-300 active:scale-[0.98]"
                      >
                        {/* The unit is already named in the line above, and
                            repeating it here produces "+1 books". */}
                        Log one
                      </button>
                    </div>
                  )}

                  {confirmDelete === goal.id ? (
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={() => {
                          deleteGoal(goal.id);
                          setConfirmDelete(null);
                        }}
                        className="flex-1 rounded-lg border border-blood-500/50 py-1.5 text-[11px] text-blood-400"
                      >
                        Yes, drop it
                      </button>
                      <button
                        onClick={() => setConfirmDelete(null)}
                        className="flex-1 rounded-lg border border-white/12 py-1.5 text-[11px] text-white/45"
                      >
                        Keep it
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDelete(goal.id)}
                      className="mt-2 w-full rounded-lg border border-white/10 py-1 text-[10px] text-white/25"
                    >
                      Drop this goal
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <button
          onClick={onClose}
          className="mt-6 w-full rounded-xl border border-white/15 py-2.5 text-sm text-white/70"
        >
          Close
        </button>
      </div>
    </div>
  );
}

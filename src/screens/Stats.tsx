import { useMemo } from 'react';
import { useStore } from '../store';
import { ATTRIBUTE_INFO, ATTRIBUTE_KEYS } from '../lib/rpg';
import { todayStr } from '../lib/date';
import {
  formatWeekLabel,
  getAttributeTrend,
  getQuestStats,
  getWeekdayStats,
  RATE_WINDOW_DAYS,
} from '../lib/stats';

function rateColor(rate: number): string {
  if (rate >= 80) return 'var(--color-verdant-500)';
  if (rate >= 50) return 'var(--color-gold-500)';
  return 'var(--color-blood-500)';
}

export function Stats({ onClose }: { onClose: () => void }) {
  const habits = useStore((s) => s.habits);
  const completions = useStore((s) => s.completions);
  const today = todayStr();

  const quests = useMemo(() => getQuestStats(habits, completions, today), [habits, completions, today]);
  const weekdays = useMemo(() => getWeekdayStats(habits, completions, today), [habits, completions, today]);
  const trend = useMemo(() => getAttributeTrend(habits, completions, today), [habits, completions, today]);

  const rated = weekdays.filter((d) => d.rate !== null);
  const best = rated.length ? rated.reduce((a, b) => (b.rate! > a.rate! ? b : a)) : null;
  const worst = rated.length ? rated.reduce((a, b) => (b.rate! < a.rate! ? b : a)) : null;
  const peak = Math.max(1, ...trend.flatMap((p) => ATTRIBUTE_KEYS.map((k) => p.xp[k])));
  const anyTrend = trend.some((p) => ATTRIBUTE_KEYS.some((k) => p.xp[k] > 0));

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
      <div className="max-h-[92dvh] w-full max-w-[560px] overflow-y-auto rounded-t-3xl border-t border-gold-500/40 bg-ink-900 p-5 pb-8">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />
        <h2 className="font-display text-lg font-bold text-gold-300">Statistics</h2>

        <h3 className="mt-5 font-display text-sm uppercase tracking-widest text-white/50">
          Per quest · last {RATE_WINDOW_DAYS} days
        </h3>
        {quests.length === 0 ? (
          <p className="mt-2 text-xs text-white/35">No active quests to measure yet.</p>
        ) : (
          <div className="mt-2 flex flex-col gap-2.5">
            {quests.map((q) => (
              <div key={q.habitId} className="rounded-xl border border-white/10 bg-ink-800/40 p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm text-white/85">{q.name}</span>
                  <span
                    className="shrink-0 font-display text-sm font-semibold"
                    style={{ color: q.rate === null ? 'rgba(255,255,255,0.3)' : rateColor(q.rate) }}
                  >
                    {q.rate === null ? '—' : `${q.rate}%`}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/8">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${q.rate ?? 0}%`,
                      background: q.rate === null ? 'transparent' : rateColor(q.rate),
                    }}
                  />
                </div>
                <p className="mt-1.5 text-[11px] text-white/35">
                  {q.completed} of {q.due} due · 🔥 {q.streak} now
                  <span className="text-white/25"> · best {q.bestStreak}</span>
                </p>
              </div>
            ))}
          </div>
        )}

        <h3 className="mt-6 font-display text-sm uppercase tracking-widest text-white/50">By day of week</h3>
        {best && worst && best.day !== worst.day ? (
          <p className="mt-1 text-[11px] text-white/40">
            Strongest on <span className="text-verdant-400">{best.label}</span>, weakest on{' '}
            <span className="text-blood-400">{worst.label}</span>.
          </p>
        ) : (
          <p className="mt-1 text-[11px] text-white/35">Not enough history to call a best or worst day yet.</p>
        )}
        <div className="mt-3 flex items-end justify-between gap-1.5">
          {weekdays.map((d) => (
            <div key={d.day} className="flex flex-1 flex-col items-center gap-1">
              <span className="text-[10px] text-white/30">{d.rate === null ? '—' : `${d.rate}%`}</span>
              <div className="flex h-20 w-full items-end overflow-hidden rounded-md bg-white/5">
                <div
                  className="w-full rounded-md transition-all"
                  style={{
                    height: `${d.rate ?? 0}%`,
                    background: d.rate === null ? 'transparent' : rateColor(d.rate),
                  }}
                />
              </div>
              <span className="text-[10px] text-white/45">{d.label}</span>
            </div>
          ))}
        </div>

        <h3 className="mt-6 font-display text-sm uppercase tracking-widest text-white/50">
          XP by attribute, per week
        </h3>
        {!anyTrend ? (
          <p className="mt-2 text-xs text-white/35">Nothing logged in the last eight weeks.</p>
        ) : (
          <>
            <div className="mt-3 flex items-end justify-between gap-1">
              {trend.map((p) => (
                <div key={p.weekStart} className="flex flex-1 flex-col items-center gap-1">
                  {/* One stacked column per week, tallest attribute first so a
                      big total can't hide a small one behind it. */}
                  <div className="flex h-24 w-full flex-col-reverse overflow-hidden rounded-md bg-white/5">
                    {ATTRIBUTE_KEYS.filter((k) => p.xp[k] > 0).map((k) => (
                      <div
                        key={k}
                        style={{
                          height: `${(p.xp[k] / peak) * 100}%`,
                          background: ATTRIBUTE_INFO[k].color,
                        }}
                      />
                    ))}
                  </div>
                  <span className="text-[9px] text-white/35">{formatWeekLabel(p.weekStart)}</span>
                </div>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1">
              {ATTRIBUTE_KEYS.map((k) => (
                <span key={k} className="flex items-center gap-1 text-[10px] text-white/40">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ background: ATTRIBUTE_INFO[k].color }}
                  />
                  {k}
                </span>
              ))}
            </div>
          </>
        )}

        <button
          onClick={onClose}
          className="mt-5 w-full rounded-lg border border-white/15 py-2.5 text-sm font-medium text-white/70"
        >
          Close
        </button>
      </div>
    </div>
  );
}

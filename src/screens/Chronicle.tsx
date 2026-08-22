import { useMemo } from 'react';
import { useStore } from '../store';
import { getDailyXpTotals } from '../lib/history';
import { XpHistoryChart } from '../components/XpHistoryChart';
import { BOSS_ROSTER } from '../lib/boss';
import { BossMonster } from '../components/BossMonster';

type FeedEntry = { id: string; date: string; icon: string; label: string; detail: string; color: string };

export function Chronicle() {
  const habits = useStore((s) => s.habits);
  const completions = useStore((s) => s.completions);
  const redemptions = useStore((s) => s.redemptions);
  const bossVictories = useStore((s) => s.bossVictories);
  const bossColorByName = useMemo(() => new Map(BOSS_ROSTER.map((b) => [b.name, b.color])), []);

  const totalXp = useMemo(() => completions.reduce((sum, c) => sum + c.xpAwarded, 0), [completions]);
  const longestStreak = useMemo(() => habits.reduce((max, h) => Math.max(max, h.bestStreak), 0), [habits]);
  const chartData = useMemo(() => getDailyXpTotals(completions, 14), [completions]);

  const habitNameById = useMemo(() => new Map(habits.map((h) => [h.id, h.name])), [habits]);

  const feed = useMemo<FeedEntry[]>(() => {
    const completionEntries: FeedEntry[] = completions.map((c) => ({
      id: c.id,
      date: c.date,
      icon: '✅',
      label: habitNameById.get(c.habitId) ?? 'Quest',
      detail: `+${c.xpAwarded} XP · +${c.goldAwarded}🪙`,
      color: 'text-verdant-400',
    }));
    const redemptionEntries: FeedEntry[] = redemptions.map((r) => ({
      id: r.id,
      date: r.date,
      icon: '🎁',
      label: r.rewardName,
      detail: `-${r.cost}🪙`,
      color: 'text-gold-300',
    }));
    return [...completionEntries, ...redemptionEntries]
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
      .slice(0, 40);
  }, [completions, redemptions, habitNameById]);

  return (
    <div className="flex flex-col gap-4 px-4 pb-28 pt-6">
      <h1 className="font-display text-xl font-bold text-gold-300">Chronicle</h1>

      <div className="grid grid-cols-2 gap-2.5">
        <StatTile label="Total XP earned" value={totalXp} icon="⭐" />
        <StatTile label="Quests completed" value={completions.length} icon="✅" />
        <StatTile label="Longest streak" value={longestStreak} icon="🔥" />
        <StatTile label="Rewards redeemed" value={redemptions.length} icon="🎁" />
      </div>

      <XpHistoryChart data={chartData} />

      {bossVictories.length > 0 && (
        <div>
          <h2 className="font-display text-sm uppercase tracking-widest text-white/50">Boss trophies</h2>
          <div className="mt-2 flex flex-col gap-1.5">
            {[...bossVictories].reverse().map((v) => (
              <div key={v.id} className="parchment-border flex items-center gap-3 rounded-xl bg-ink-800/50 p-2.5">
                <BossMonster color={bossColorByName.get(v.bossName) ?? 'var(--color-gold-500)'} size={32} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white/90">{v.bossName}</p>
                  <p className="text-[11px] text-white/40">
                    Week of {v.weekStart} · {v.xpEarned} XP
                  </p>
                </div>
                <span className="shrink-0 text-xs text-gold-300">+{v.goldReward}🪙</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="font-display text-sm uppercase tracking-widest text-white/50">Activity</h2>
        {feed.length === 0 ? (
          <p className="mt-2 text-sm text-white/40">Nothing logged yet — complete a quest to get started.</p>
        ) : (
          <div className="mt-2 flex flex-col gap-1.5">
            {feed.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between rounded-lg bg-ink-800/30 px-3 py-2 text-sm"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span>{entry.icon}</span>
                  <span className="truncate text-white/80">{entry.label}</span>
                </span>
                <span className="shrink-0 text-right text-xs">
                  <span className={entry.color}>{entry.detail}</span>
                  <span className="ml-2 text-white/30">{entry.date.slice(5)}</span>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatTile({ label, value, icon }: { label: string; value: number; icon: string }) {
  return (
    <div className="parchment-border rounded-xl bg-ink-800/50 p-3 text-center">
      <p className="text-xl">{icon}</p>
      <p className="mt-1 font-display text-lg font-bold text-gold-300">{value}</p>
      <p className="text-[11px] text-white/40">{label}</p>
    </div>
  );
}

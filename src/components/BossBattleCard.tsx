import { useMemo } from 'react';
import { useStore } from '../store';
import { getBossForWeek, getBossThreshold, getWeeklyXpEarned, getWeekEnd, getWeekStart } from '../lib/boss';
import { parseDate, todayStr } from '../lib/date';
import { BossMonster } from './BossMonster';
import { XpBar } from './XpBar';

export function BossBattleCard() {
  const habits = useStore((s) => s.habits);
  const completions = useStore((s) => s.completions);
  const bossVictories = useStore((s) => s.bossVictories);
  const claimBossVictory = useStore((s) => s.claimBossVictory);

  const today = todayStr();
  const weekStart = getWeekStart(today);
  const weekEnd = getWeekEnd(weekStart);
  const boss = useMemo(() => getBossForWeek(weekStart), [weekStart]);
  const activeHabits = useMemo(() => habits.filter((h) => !h.archived), [habits]);
  const threshold = useMemo(() => getBossThreshold(activeHabits), [activeHabits]);
  const xpEarned = useMemo(() => getWeeklyXpEarned(completions, weekStart), [completions, weekStart]);
  const claimed = bossVictories.some((v) => v.weekStart === weekStart);
  const pct = Math.min(100, Math.round((xpEarned / threshold) * 100));
  const canClaim = !claimed && xpEarned >= threshold;
  const daysLeft = Math.max(0, Math.round((parseDate(weekEnd).getTime() - parseDate(today).getTime()) / 86400000));

  return (
    <div className="parchment-border rounded-xl bg-ink-800/50 p-4">
      <div className="flex items-center gap-3">
        <BossMonster color={boss.color} size={48} />
        <div className="min-w-0 flex-1">
          <p className="font-display font-semibold" style={{ color: boss.color }}>
            {boss.name}
          </p>
          <p className="text-[11px] text-white/40">
            {claimed
              ? 'Defeated this week ✓'
              : daysLeft > 0
                ? `${daysLeft} day${daysLeft === 1 ? '' : 's'} left this week`
                : 'Last day to strike!'}
          </p>
        </div>
        {canClaim && (
          <button
            onClick={claimBossVictory}
            className="shrink-0 rounded-full bg-gold-500 px-3 py-1.5 text-xs font-semibold text-ink-950 active:scale-95"
          >
            Defeat!
          </button>
        )}
      </div>
      <div className="mt-3">
        <XpBar level={1} xp={0} pct={pct} color={boss.color} height={10} />
      </div>
      <p className="mt-1 text-right text-[11px] text-white/35">
        {Math.min(xpEarned, threshold)} / {threshold} XP this week
      </p>
    </div>
  );
}

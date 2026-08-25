import { useMemo } from 'react';
import { useStore } from '../store';
import { getBossForWeek, getWeeklyXpEarned, getWeekEnd, getWeekStart, resolveBossThreshold } from '../lib/boss';
import { parseDate, todayStr } from '../lib/date';
import { isWeekOnVacation } from '../lib/vacation';
import { BossMonster } from './BossMonster';
import { XpBar } from './XpBar';

export function BossBattleCard() {
  const habits = useStore((s) => s.habits);
  const completions = useStore((s) => s.completions);
  const bossVictories = useStore((s) => s.bossVictories);
  const bossWeek = useStore((s) => s.bossWeek);
  const vacations = useStore((s) => s.vacations);

  const today = todayStr();
  const weekStart = getWeekStart(today);
  const weekEnd = getWeekEnd(weekStart);
  const boss = useMemo(() => getBossForWeek(weekStart), [weekStart]);
  // The target is whatever was frozen when the week began, so editing quests
  // mid-week can't move the bar you're being measured against.
  const threshold = useMemo(
    () => resolveBossThreshold(habits.filter((h) => !h.archived), weekStart, bossWeek),
    [bossWeek, weekStart, habits],
  );
  const xpEarned = useMemo(() => getWeeklyXpEarned(completions, weekStart), [completions, weekStart]);
  const victory = bossVictories.find((v) => v.weekStart === weekStart);
  const onVacation = isWeekOnVacation(vacations, weekStart);
  const pct = Math.min(100, Math.round((xpEarned / threshold) * 100));
  const daysLeft = Math.max(0, Math.round((parseDate(weekEnd).getTime() - parseDate(today).getTime()) / 86400000));

  // No boss stalks a week you were away for — showing an unbeatable bar would
  // just read as a loss you can't do anything about.
  if (onVacation && !victory) {
    return (
      <div className="parchment-border rounded-xl bg-ink-800/50 p-4">
        <div className="flex items-center gap-3 opacity-50 grayscale">
          <BossMonster color={boss.color} size={48} />
          <div className="min-w-0 flex-1">
            <p className="font-display font-semibold" style={{ color: boss.color }}>
              {boss.name}
            </p>
            <p className="text-[11px] text-white/40">Sleeping — no boss while you're on vacation</p>
          </div>
          <span className="shrink-0 text-lg">💤</span>
        </div>
      </div>
    );
  }

  return (
    <div className="parchment-border rounded-xl bg-ink-800/50 p-4">
      <div className="flex items-center gap-3">
        <BossMonster color={boss.color} size={48} />
        <div className="min-w-0 flex-1">
          <p className="font-display font-semibold" style={{ color: boss.color }}>
            {boss.name}
          </p>
          <p className="text-[11px] text-white/40">
            {victory
              ? `Defeated ✓ +${victory.goldReward} gold`
              : daysLeft > 0
                ? `${daysLeft} day${daysLeft === 1 ? '' : 's'} left this week`
                : 'Last day to strike!'}
          </p>
        </div>
        {victory && <span className="shrink-0 text-lg">🏆</span>}
      </div>
      <div className="mt-3">
        <XpBar level={1} xp={0} pct={pct} color={boss.color} height={10} />
      </div>
      <p className="mt-1 text-right text-[11px] text-white/35">
        {Math.min(xpEarned, threshold)} / {threshold} quest XP this week
      </p>
    </div>
  );
}

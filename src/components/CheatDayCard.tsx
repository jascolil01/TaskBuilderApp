import { useStore } from '../store';
import { CHEAT_DAY_RECHARGE_COMPLETIONS } from '../lib/rpg';
import { todayStr } from '../lib/date';

/**
 * A rest day can come from two places: the Constitution signature perk, or a
 * Rest Day Token bought in the shop. Both mark the same day as forgiven, so
 * they're presented together rather than as two competing cards.
 */
export function CheatDayCard() {
  const cheatDay = useStore((s) => s.character.cheatDay);
  const restDayTokens = useStore((s) => s.character.inventory.restDayTokens);
  const spendCheatDay = useStore((s) => s.spendCheatDay);
  const spendRestDay = useStore((s) => s.spendRestDay);

  const usedToday = cheatDay.usedDates.includes(todayStr());
  if (!cheatDay.unlocked && restDayTokens === 0 && !usedToday) return null;

  const pct = Math.min(100, Math.round((cheatDay.progressToNext / CHEAT_DAY_RECHARGE_COMPLETIONS) * 100));
  const canUsePerk = !usedToday && cheatDay.charges > 0;
  const canUseToken = !usedToday && !canUsePerk && restDayTokens > 0;

  const detail = () => {
    if (usedToday) return 'Today is forgiven — no quest decays and every streak survives.';
    if (canUsePerk) return 'A full rest day — every quest due today is forgiven, streaks intact.';
    if (canUseToken) return `You have ${restDayTokens} Rest Day Token${restDayTokens === 1 ? '' : 's'} banked.`;
    return `Recharging — ${cheatDay.progressToNext}/${CHEAT_DAY_RECHARGE_COMPLETIONS} completions.`;
  };

  return (
    <div className="parchment-border rounded-xl bg-ink-800/50 p-3.5">
      <div className="flex items-center gap-3">
        <span className="text-2xl">{canUseToken ? '🌙' : '🍰'}</span>
        <div className="min-w-0 flex-1">
          <p className="font-display font-semibold text-gold-300">Rest Day</p>
          <p className="mt-0.5 text-[11px] text-white/40">{detail()}</p>
        </div>
        {canUsePerk && (
          <button
            onClick={spendCheatDay}
            className="shrink-0 rounded-full bg-gold-500 px-3 py-1.5 text-xs font-semibold text-ink-950 active:scale-95"
          >
            Use today
          </button>
        )}
        {canUseToken && (
          <button
            onClick={spendRestDay}
            className="shrink-0 rounded-full bg-gold-500 px-3 py-1.5 text-xs font-semibold text-ink-950 active:scale-95"
          >
            Use token
          </button>
        )}
        {usedToday && <span className="shrink-0 text-xs text-verdant-400">Resting ✓</span>}
      </div>

      {cheatDay.unlocked && cheatDay.charges === 0 && !usedToday && (
        <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-black/35">
          <div className="h-full rounded-full bg-gold-500 transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}

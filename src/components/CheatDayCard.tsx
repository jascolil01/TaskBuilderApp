import { useStore } from '../store';
import { CHEAT_DAY_RECHARGE_COMPLETIONS } from '../lib/rpg';
import { todayStr } from '../lib/date';

export function CheatDayCard() {
  const cheatDay = useStore((s) => s.character.cheatDay);
  const spendCheatDay = useStore((s) => s.spendCheatDay);

  if (!cheatDay.unlocked) return null;

  const usedToday = cheatDay.usedDates.includes(todayStr());
  const pct = Math.min(100, Math.round((cheatDay.progressToNext / CHEAT_DAY_RECHARGE_COMPLETIONS) * 100));

  return (
    <div className="parchment-border rounded-xl bg-ink-800/50 p-3.5">
      <div className="flex items-center gap-3">
        <span className="text-2xl">🍰</span>
        <div className="min-w-0 flex-1">
          <p className="font-display font-semibold text-gold-300">Cheat Day</p>
          <p className="mt-0.5 text-[11px] text-white/40">
            {usedToday
              ? 'Today is forgiven — Constitution quests take no decay.'
              : cheatDay.charges > 0
                ? 'Forgives a whole day of Constitution quests. Streaks survive.'
                : `Recharging — ${cheatDay.progressToNext}/${CHEAT_DAY_RECHARGE_COMPLETIONS} completions.`}
          </p>
        </div>
        {!usedToday && cheatDay.charges > 0 && (
          <button
            onClick={spendCheatDay}
            className="shrink-0 rounded-full bg-gold-500 px-3 py-1.5 text-xs font-semibold text-ink-950 active:scale-95"
          >
            Use today
          </button>
        )}
        {usedToday && <span className="shrink-0 text-xs text-verdant-400">Resting ✓</span>}
      </div>

      {cheatDay.charges === 0 && !usedToday && (
        <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-black/35">
          <div
            className="h-full rounded-full bg-gold-500 transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

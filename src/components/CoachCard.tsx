import { useMemo } from 'react';
import { useStore } from '../store';
import { getSuggestion } from '../lib/coach';
import { RATE_WINDOW_DAYS } from '../lib/stats';
import { todayStr } from '../lib/date';

/**
 * The one quest worth rethinking, with the fix attached.
 *
 * Tone is the whole design here. This card exists at the moment someone is
 * already failing at something, which is exactly when an app can make them
 * close it for good. So: no red, no warning triangle, no percentage in a
 * scolding colour. It states the number plainly, says what it would change,
 * and the loudest button on the card is the one that fixes it.
 *
 * "Keep it as it is" is a real option and sits right next to the fix, because
 * sometimes a hard quest kept 40% of the time is exactly the quest you want.
 */
export function CoachCard() {
  const habits = useStore((s) => s.habits);
  const completions = useStore((s) => s.completions);
  const coachSnoozed = useStore((s) => s.coachSnoozed);
  const applySuggestion = useStore((s) => s.applySuggestion);
  const dismissSuggestion = useStore((s) => s.dismissSuggestion);
  const today = todayStr();

  const suggestion = useMemo(
    () => getSuggestion(habits, completions, coachSnoozed, today),
    [habits, completions, coachSnoozed, today],
  );

  if (!suggestion) return null;

  return (
    <div className="rounded-xl border border-mana-500/35 bg-mana-500/[0.07] p-3.5">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-display text-sm font-semibold text-mana-300">Worth a rethink</h3>
        <span className="shrink-0 text-[11px] tabular-nums text-white/40">
          {suggestion.completed} of {suggestion.due} · last {RATE_WINDOW_DAYS} days
        </span>
      </div>

      <p className="mt-1.5 text-[13px] leading-relaxed text-white/75">
        <span className="text-white/95">{suggestion.name}</span> has landed {suggestion.rate}% of the times it was
        due.
      </p>
      <p className="mt-1.5 text-[11px] leading-relaxed text-white/45">{suggestion.rationale}</p>

      <div className="mt-3 flex gap-2">
        <button
          onClick={() => applySuggestion(suggestion)}
          className="flex-1 rounded-lg border border-mana-500/60 bg-mana-500/15 py-2 text-xs font-medium text-mana-200 active:scale-[0.98]"
        >
          {suggestion.action}
        </button>
        <button
          onClick={() => dismissSuggestion(suggestion.habitId)}
          className="rounded-lg border border-white/12 px-3 py-2 text-xs text-white/45 active:scale-[0.98]"
        >
          Keep it as it is
        </button>
      </div>
    </div>
  );
}

import { useMemo } from 'react';
import { useStore } from '../store';
import { isAtRisk, isDecaying } from '../lib/rpg';

/**
 * Explains decay once, the first time it's about to matter.
 *
 * Decay is the one rule in the app that takes something away, and until now
 * nobody was ever told it existed — the first a new player knew of it was an
 * attribute quietly going down. Being ambushed by a punishment is how people
 * decide an app is unfair and stop opening it.
 *
 * Shown at the last useful moment rather than during onboarding: a wall of
 * rules at signup is read by nobody, whereas "this is about to happen to you,
 * here's what it is" arrives when it's relevant. It is dismissed permanently
 * on acknowledgement, never shown twice, and never shown at all to someone
 * who simply never misses.
 */
export function DecayNotice() {
  const habits = useStore((s) => s.habits);
  const attributes = useStore((s) => s.character.attributes);
  const explained = useStore((s) => s.settings.decayExplained ?? false);
  const markDecayExplained = useStore((s) => s.markDecayExplained);

  // The trigger is a quest inside its grace period — missed, but not yet
  // charged. That's the only moment where the warning is both relevant and
  // still actionable.
  const atRisk = useMemo(
    () => habits.find((h) => !h.archived && (isAtRisk(h, attributes) || isDecaying(h, attributes))),
    [habits, attributes],
  );

  if (explained || !atRisk) return null;

  const alreadyBiting = isDecaying(atRisk, attributes);

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="parchment-border w-full max-w-[460px] rounded-2xl bg-ink-900 p-5">
        <h2 className="font-display text-base font-bold text-gold-300">
          {alreadyBiting ? 'Your attributes are slipping' : 'A word before this bites'}
        </h2>

        <p className="mt-2.5 text-[13px] leading-relaxed text-white/65">
          <span className="text-white/90">{atRisk.name}</span> has been missed
          {atRisk.missedSinceCompletion === 1 ? ' once' : ` ${atRisk.missedSinceCompletion} times`}.
        </p>

        <p className="mt-2.5 text-[13px] leading-relaxed text-white/65">
          Quests don't only pay out — they also fall behind. Miss more days than a quest's grace period allows and its
          attribute starts losing XP, a little for each further miss. It's what keeps your attributes a picture of what
          you're doing now rather than a tally of everything you ever did.
        </p>

        <div className="mt-3 rounded-xl border border-white/10 bg-ink-800/50 p-3">
          <p className="text-[11px] leading-relaxed text-white/50">
            Nothing here is a trap. A <span className="text-white/75">Cheat Day</span> forgives a whole day,{' '}
            <span className="text-white/75">vacation mode</span> forgives a trip, and both leave your streak intact. A{' '}
            <span className="text-white/75">Streak Save</span> from the shop absorbs the first hit. And if you genuinely
            did it and just forgot to log it, the quest card will offer to backfill yesterday.
          </p>
        </div>

        <button
          onClick={markDecayExplained}
          className="mt-4 w-full rounded-xl border border-gold-500/60 bg-gold-500/10 py-2.5 text-sm font-medium text-gold-300 active:scale-[0.98]"
        >
          Understood
        </button>
      </div>
    </div>
  );
}

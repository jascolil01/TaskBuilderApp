/**
 * The reward side of consistency, and the mirror of decay.
 *
 * Decay only ever took XP away for neglect; nothing paid you back for the
 * quest you'd kept for three months. This is that: a ladder of tiers a quest
 * climbs as its streak lengthens, each one raising the XP that quest pays.
 *
 * Two deliberate limits:
 *
 * - **XP only.** Gold is untouched. XP is a closed loop — it only levels
 *   attributes — so inflating it can't break anything downstream. Gold buys
 *   real-life rewards whose prices and cooldowns are tuned around a roughly
 *   fixed daily income; a 50% raise there would quietly turn the Legendary
 *   reward's advertised two months into six weeks.
 *
 * - **Capped at +50%.** Uncapped growth would make one ancient habit worth
 *   more than several new ones, which is exactly the wrong incentive for an
 *   app whose point is starting things.
 *
 * The weekly boss is unaffected by design: completions record `baseXp` and the
 * boss scores in those units, so a long streak can't quietly trivialise it.
 */

export interface StreakTier {
  /** Streak length at which this tier is reached. */
  days: number;
  /** Extra XP, as a fraction of the quest's face value. */
  bonus: number;
  name: string;
}

/**
 * Index 0 is "no tier yet" and exists so a tier can be stored as a plain
 * number and stepped up or down by one without special cases.
 */
export const STREAK_TIERS: readonly StreakTier[] = [
  { days: 0, bonus: 0, name: 'None' },
  { days: 7, bonus: 0.1, name: 'Kindled' },
  { days: 21, bonus: 0.2, name: 'Ironclad' },
  { days: 45, bonus: 0.35, name: 'Relentless' },
  { days: 90, bonus: 0.5, name: 'Legendary' },
];

export const MAX_TIER_INDEX = STREAK_TIERS.length - 1;

export function clampTier(index: number): number {
  if (!Number.isFinite(index)) return 0;
  return Math.min(MAX_TIER_INDEX, Math.max(0, Math.floor(index)));
}

/** The highest tier a streak of this length has earned outright. */
export function tierForStreak(streak: number): number {
  let index = 0;
  for (let i = 1; i < STREAK_TIERS.length; i += 1) {
    if (streak >= STREAK_TIERS[i].days) index = i;
  }
  return index;
}

/**
 * The tier actually in force.
 *
 * A break drops the retained tier by one step rather than wiping it, so three
 * months of work isn't erased by a single bad day. That retained value can
 * therefore sit *above* what the current streak has earned back, which is the
 * whole point — hence the max rather than just reading the streak.
 */
export function effectiveTier(retained: number | undefined, streak: number): number {
  return Math.max(clampTier(retained ?? 0), tierForStreak(streak));
}

export function getStreakBonus(tierIndex: number): number {
  return STREAK_TIERS[clampTier(tierIndex)].bonus;
}

export function getTierName(tierIndex: number): string {
  return STREAK_TIERS[clampTier(tierIndex)].name;
}

/** The tier above this one, or null at the top of the ladder. */
export function nextTier(tierIndex: number): StreakTier | null {
  const next = clampTier(tierIndex) + 1;
  return next <= MAX_TIER_INDEX ? STREAK_TIERS[next] : null;
}

/**
 * Days of streak still to go before the next tier, or null when there is no
 * next tier. Returns null too when a retained tier already sits above what the
 * streak has earned — there is nothing meaningful to count down to while
 * you're rebuilding back up to a bonus you already hold.
 */
export function daysToNextTier(retained: number | undefined, streak: number): number | null {
  const held = effectiveTier(retained, streak);
  const next = nextTier(held);
  if (!next) return null;
  return Math.max(1, next.days - streak);
}

/** True when `newStreak` is the exact day a fresh tier is reached. */
export function crossesTier(retained: number | undefined, newStreak: number): boolean {
  if (newStreak <= 0) return false;
  return tierForStreak(newStreak) > effectiveTier(retained, newStreak - 1);
}

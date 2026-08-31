/**
 * How much work a quest actually is.
 *
 * This replaced a bare 5–50 slider that asked "how many XP is this worth?" —
 * a question with no honest answer, which is why any number felt arbitrary.
 * Each tier is anchored to roughly how long the thing takes instead. Nothing
 * is timed or verified; the label exists purely so the truthful choice is the
 * obvious one when you're picking.
 *
 * The tier drives two very different currencies:
 *
 *   XP    — your character's progress. Scales hard with effort (5 to 50),
 *           and that's safe: decay costs a share of the same number, and the
 *           weekly boss target is a share of it too, so rating everything
 *           Major raises the stakes as much as the rewards.
 *
 *   Gold  — what buys real-world rewards, at prices fixed in gold. This is the
 *           one that had to be protected: when gold was simply 1:1 with XP,
 *           rating five daily quests Major instead of Short took the 3000-gold
 *           Legendary reward from its advertised two months down to twelve
 *           days. So gold is paid mostly for *doing a quest at all*, with
 *           difficulty as a modest bonus rather than a multiplier.
 */

export type EffortTier = 'quick' | 'short' | 'real' | 'hard' | 'major';

export const EFFORT_ORDER: EffortTier[] = ['quick', 'short', 'real', 'hard', 'major'];

/**
 * Gold for one completion at the baseline tier. Tuned so a normal day — four
 * or so middling quests — earns about 48 gold, which keeps the reward tiers
 * honest: the Legendary still takes roughly the two months it advertises.
 */
export const BASE_GOLD = 12;

export interface EffortInfo {
  label: string;
  /** The anchor. Never measured — it's here to make the honest pick obvious. */
  time: string;
  hint: string;
  xp: number;
  /** Difficulty bonus on gold. Deliberately gentle; see the note above. */
  goldMultiplier: number;
}

export const EFFORT_TIERS: Record<EffortTier, EffortInfo> = {
  quick: {
    label: 'Quick',
    time: 'under 5 minutes',
    hint: 'Vitamins, making the bed, a glass of water.',
    xp: 5,
    goldMultiplier: 0.8,
  },
  short: {
    label: 'Short',
    time: 'around 15 minutes',
    hint: 'A walk, tidying up, a few pages.',
    xp: 10,
    goldMultiplier: 0.9,
  },
  real: {
    label: 'Real',
    time: 'around half an hour',
    hint: 'A proper session — most habits worth building live here.',
    xp: 20,
    goldMultiplier: 1,
  },
  hard: {
    label: 'Hard',
    time: 'an hour, or genuinely unpleasant',
    hint: 'A full workout, deep work, the thing you keep avoiding.',
    xp: 35,
    goldMultiplier: 1.2,
  },
  major: {
    label: 'Major',
    time: 'hours, or a real lift',
    hint: 'Rare. If more than one or two quests are Major, they probably aren’t.',
    xp: 50,
    goldMultiplier: 1.4,
  },
};

export function getEffortXp(tier: EffortTier): number {
  return EFFORT_TIERS[tier].xp;
}

export function getEffortGold(tier: EffortTier): number {
  return Math.max(1, Math.round(BASE_GOLD * EFFORT_TIERS[tier].goldMultiplier));
}

/** Maps a hand-set XP value from the old slider onto the closest tier. */
export function inferEffort(xpReward: number): EffortTier {
  let best: EffortTier = 'real';
  let bestDelta = Number.POSITIVE_INFINITY;
  for (const tier of EFFORT_ORDER) {
    const delta = Math.abs(EFFORT_TIERS[tier].xp - xpReward);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = tier;
    }
  }
  return best;
}

export function isEffortTier(value: unknown): value is EffortTier {
  return typeof value === 'string' && (EFFORT_ORDER as string[]).includes(value);
}

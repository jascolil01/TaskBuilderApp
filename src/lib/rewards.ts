import type { AttributeKey } from '../types';
import { addDays, parseDate } from './date';
import type { RewardTier } from './shop';
import { REWARD_TIERS, REWARD_TIER_ORDER } from './shop';

/**
 * Two things kept the Rewards tab from feeling like a game you could lose.
 *
 * The prices are fixed by tier, but nothing stopped you filing every reward
 * under Minor — a weekend away for 150 gold is the same self-discounting the
 * fixed tiers were meant to end, just moved one level up. So each class now
 * ships a curated reward at every tier: a reference point for what a Standard
 * or a Legendary is actually supposed to feel like, at a price you can't edit.
 *
 * And nothing stopped you redeeming the same cheap reward over and over the
 * moment you'd banked the gold. Every reward now rests after it's claimed, for
 * roughly as long as it takes to earn again, so a treat stays a treat.
 */

/** How long a reward rests after being claimed, by tier. */
export const TIER_COOLDOWN_DAYS: Record<RewardTier, number> = {
  minor: 3,
  standard: 7,
  major: 30,
  legendary: 90,
};

export const COOLDOWN_LABEL: Record<RewardTier, string> = {
  minor: 'once every few days',
  standard: 'once a week',
  major: 'once a month',
  legendary: 'once a season',
};

/** Curated rewards, one per tier per class. Ids are stable and synthetic. */
export const CLASS_REWARDS: Record<AttributeKey, Record<RewardTier, string>> = {
  STR: {
    minor: 'A long hot shower and an early night',
    standard: 'New training gear',
    major: 'A massage or a sports therapy session',
    legendary: 'A weekend away somewhere physical — hills, water, rock',
  },
  DEX: {
    minor: 'An hour on a game, no guilt',
    standard: 'A night out with people you like',
    major: "That piece of kit you've been circling for months",
    legendary: "A trip somewhere you've never been",
  },
  CON: {
    minor: 'A proper lie-in, alarm off',
    standard: 'A really good meal, someone else cooking',
    major: 'A full day off with every plan cancelled',
    legendary: 'A few days entirely off, somewhere else',
  },
  INT: {
    minor: 'A new book, bought on impulse',
    standard: "The course you've had bookmarked for a year",
    major: 'A conference, or the equipment you keep talking yourself out of',
    legendary: 'A week off to build the thing you never have time for',
  },
  WIS: {
    minor: 'An hour of nothing at all',
    standard: 'A whole day with your phone off',
    major: 'A weekend retreat',
    legendary: 'A week somewhere quiet, on your own terms',
  },
  CHA: {
    minor: 'Call the person you keep meaning to call',
    standard: 'Dinner with people you love',
    major: 'Throw the thing — the party, the dinner, the gig',
    legendary: 'A trip to see someone who lives too far away',
  },
};

export interface ClassReward {
  id: string;
  name: string;
  tier: RewardTier;
  attribute: AttributeKey;
  cost: number;
}

export function getClassRewards(attribute: AttributeKey): ClassReward[] {
  return REWARD_TIER_ORDER.map((tier) => ({
    id: `class-${attribute.toLowerCase()}-${tier}`,
    name: CLASS_REWARDS[attribute][tier],
    tier,
    attribute,
    cost: REWARD_TIERS[tier].cost,
  }));
}

const CLASS_REWARD_ID = /^class-(str|dex|con|int|wis|cha)-(minor|standard|major|legendary)$/;

export function isClassRewardId(id: string): boolean {
  return CLASS_REWARD_ID.test(id);
}

/** Resolves a synthetic id back to its catalog entry, or null if it's junk. */
export function getClassReward(id: string): ClassReward | null {
  const match = CLASS_REWARD_ID.exec(id);
  if (!match) return null;
  const attribute = match[1].toUpperCase() as AttributeKey;
  const tier = match[2] as RewardTier;
  return {
    id,
    name: CLASS_REWARDS[attribute][tier],
    tier,
    attribute,
    cost: REWARD_TIERS[tier].cost,
  };
}

export interface CooldownState {
  /** True while the reward is resting and can't be claimed. */
  active: boolean;
  /** The first day it can be claimed again. */
  availableOn: string | null;
  daysLeft: number;
}

const normalise = (name: string) => name.trim().toLowerCase();

/**
 * Whether a reward is still resting, given every redemption ever logged.
 * Reads the redemption log rather than storing per-reward timestamps, so it
 * stays correct through imports and can't drift out of sync.
 *
 * Matching is by id OR by name, not id alone. Ids are minted fresh on create,
 * so keying on the id alone meant "claim it, delete it, add it back" handed
 * you the same treat again the same day — the rest period was one tap from
 * being nothing at all.
 */
export function getCooldown(
  rewardId: string,
  tier: RewardTier,
  redemptions: readonly { rewardId: string; rewardName?: string; date: string }[],
  today: string,
  rewardName?: string,
): CooldownState {
  const wanted = rewardName ? normalise(rewardName) : null;
  let last: string | null = null;
  for (const r of redemptions) {
    const sameReward =
      r.rewardId === rewardId || (wanted !== null && r.rewardName !== undefined && normalise(r.rewardName) === wanted);
    if (!sameReward) continue;
    if (last === null || r.date > last) last = r.date;
  }
  if (last === null) return { active: false, availableOn: null, daysLeft: 0 };

  const availableOn = addDays(last, TIER_COOLDOWN_DAYS[tier]);
  if (today >= availableOn) return { active: false, availableOn, daysLeft: 0 };

  const daysLeft = Math.max(
    1,
    Math.round((parseDate(availableOn).getTime() - parseDate(today).getTime()) / 86400000),
  );
  return { active: true, availableOn, daysLeft };
}

/**
 * A custom reward's tier can be raised but never lowered. Deciding a treat is
 * worth less the moment you want it is exactly the self-discounting the fixed
 * tiers exist to prevent.
 */
export function canChangeTier(from: RewardTier, to: RewardTier): boolean {
  return REWARD_TIER_ORDER.indexOf(to) >= REWARD_TIER_ORDER.indexOf(from);
}

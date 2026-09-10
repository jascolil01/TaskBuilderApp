import type { ClassId } from './lib/classes';
import type { EffortTier } from './lib/effort';
import type { RewardTier } from './lib/shop';

export type AttributeKey = 'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA';

export interface AttributeState {
  level: number;
  xp: number;
}

export type Attributes = Record<AttributeKey, AttributeState>;

export type Frequency = { type: 'daily' } | { type: 'weekly'; days: number[] };

export interface Habit {
  id: string;
  name: string;
  attribute: AttributeKey;
  frequency: Frequency;
  graceDays: number;
  /**
   * How much work this quest is. Drives xpReward, and separately sets the
   * modest difficulty bonus on gold. Absent on quests created before effort
   * tiers existed; the migration infers it from xpReward.
   */
  effort?: EffortTier;
  /** Always the tier's XP value. Kept denormalised — decay, the boss target
   *  and the stats screen all read it directly. */
  xpReward: number;
  streak: number;
  bestStreak: number;
  /**
   * Streak-bonus tier held, as an index into STREAK_TIERS. Tracked separately
   * from `streak` because a break steps this down by one rather than zeroing
   * it — so it can legitimately sit above what the current streak has earned
   * back. Absent on quests saved before streak bonuses existed; the migration
   * seeds it from the streak.
   */
  bonusTier?: number;
  lastCompletedDate: string | null;
  decayedThroughDate: string | null;
  missedSinceCompletion: number;
  /** Length of the most recently broken streak, so a Phoenix Feather can restore it. */
  lastBrokenStreak?: number;
  createdAt: string;
  archived: boolean;
}

/**
 * The parts of a habit's decay/streak bookkeeping that a completion
 * overwrites. Snapshotted onto the completion so undo can restore the
 * habit exactly, rather than guessing — guessing re-runs decay over days
 * that were already charged.
 */
export interface HabitProgressSnapshot {
  streak: number;
  bestStreak: number;
  missedSinceCompletion: number;
  lastCompletedDate: string | null;
  decayedThroughDate: string | null;
  /** Absent on entries written before streak bonuses existed. */
  bonusTier?: number;
}

export interface CompletionEntry {
  id: string;
  habitId: string;
  date: string;
  xpAwarded: number;
  goldAwarded: number;
  /**
   * The quest's face-value reward, before any perk, streak or Elixir
   * multiplier. The weekly boss target is set in these units, so it has to be
   * scored in them too. Absent on entries written before this was introduced.
   */
  baseXp?: number;
  /** Set when an Elixir of Might charge paid for this completion, so undo can refund it. */
  elixirUsed?: boolean;
  /** Logged after the fact rather than on the day, so the Chronicle can say so. */
  backfilled?: boolean;
  /**
   * Decay XP handed back because this backfill cancelled a miss. Recorded so
   * undo can reverse exactly what was given, rather than guessing — the same
   * reason prevProgress exists.
   */
  xpRefunded?: number;
  /** Absent on entries written before this was introduced. */
  prevProgress?: HabitProgressSnapshot;
}

/** Consumables bought from the shop. */
export interface Inventory {
  restDayTokens: number;
  phoenixFeathers: number;
  /** Completions still owed double XP by an Elixir of Might. */
  elixirCompletions: number;
}

export interface Cosmetics {
  unlockedTitles: string[];
  unlockedRings: string[];
  activeTitle: string | null;
  /** Overrides the level-tier ring colour on the avatar when set. */
  activeRing: string | null;
  /** Gear ids owned. Ownership is permanent even if your class drifts. */
  unlockedGear: string[];
  /**
   * Gear ids currently worn, across every class. Stored flat rather than per
   * slot so a class you drift away from keeps its loadout for your return.
   */
  equippedGear: string[];
}

/**
 * Constitution's signature perk. A charge is spent to forgive a full day —
 * every quest due that day — and is re-earned through consistency rather
 * than elapsed time.
 */
export interface CheatDayState {
  /** Set once Constitution first reaches the signature level. */
  unlocked: boolean;
  charges: number;
  /** Completions logged since the last charge was spent. */
  progressToNext: number;
  /** Days already forgiven — decay skips every quest on these. */
  usedDates: string[];
}

export interface CharacterState {
  name: string;
  createdAt: string;
  attributes: Attributes;
  gold: number;
  streakSaves: number;
  /**
   * Monotonic total of every XP point ever earned. Drives character level.
   * Deliberately not derived from `completions`, so deleting a habit can
   * never retroactively demote the character.
   */
  lifetimeXp: number;
  cheatDay: CheatDayState;
  inventory: Inventory;
  cosmetics: Cosmetics;
  /**
   * Which of the twelve classes to present as. Honoured only while that class
   * is still on offer for your current attributes, so it can never pin you to
   * a class you've genuinely outgrown.
   */
  preferredClass?: ClassId | null;
  lastDecayCheck: string;
}

/**
 * A planned break. Every day it covers is forgiven by the decay pass, so
 * streaks survive a trip. Limited to two per calendar year and fourteen
 * days each.
 */
export interface Vacation {
  id: string;
  startDate: string;
  /** Inclusive. */
  endDate: string;
  createdAt: string;
  /** Set when the trip is cut short; the vacation then covers only up to this day. */
  endedEarlyOn?: string;
}

/** The boss target is frozen at the start of each week so mid-week habit edits can't move the bar. */
export interface BossWeek {
  weekStart: string;
  threshold: number;
}

export interface Reward {
  id: string;
  name: string;
  /**
   * Price comes from the tier, not from the player. A free-form cost field
   * let you quietly discount your own rewards, which defeats the point of
   * earning them.
   */
  tier: RewardTier;
  createdAt: string;
}

export interface RedemptionEntry {
  id: string;
  rewardId: string;
  rewardName: string;
  cost: number;
  date: string;
  /**
   * 'reward' is a real-life treat you cashed out; 'utility' is a gameplay
   * purchase like a Streak Save. Kept apart so buying an item doesn't
   * inflate the "rewards redeemed" stat. Absent on older entries.
   */
  kind?: 'reward' | 'utility';
}

export interface ReminderSettings {
  enabled: boolean;
  time: string;
  lastNotifiedDate: string | null;
}

export interface BossVictory {
  id: string;
  weekStart: string;
  bossName: string;
  xpEarned: number;
  threshold: number;
  goldReward: number;
  defeatedAt: string;
}

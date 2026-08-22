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
  xpReward: number;
  streak: number;
  bestStreak: number;
  lastCompletedDate: string | null;
  decayedThroughDate: string | null;
  missedSinceCompletion: number;
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
}

export interface CompletionEntry {
  id: string;
  habitId: string;
  date: string;
  xpAwarded: number;
  goldAwarded: number;
  /** Absent on entries written before this was introduced. */
  prevProgress?: HabitProgressSnapshot;
}

/**
 * Constitution's signature perk. Charges are spent to forgive a day of
 * Constitution quests, and re-earned through consistency rather than time.
 */
export interface CheatDayState {
  /** Set once Constitution first reaches the signature level. */
  unlocked: boolean;
  charges: number;
  /** Completions logged since the last charge was spent. */
  progressToNext: number;
  /** Days already forgiven — decay skips Constitution quests on these. */
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
  lastDecayCheck: string;
}

/** The boss target is frozen at the start of each week so mid-week habit edits can't move the bar. */
export interface BossWeek {
  weekStart: string;
  threshold: number;
}

export interface Reward {
  id: string;
  name: string;
  cost: number;
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

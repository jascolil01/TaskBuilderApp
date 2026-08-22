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

export interface CharacterState {
  name: string;
  createdAt: string;
  attributes: Attributes;
  gold: number;
  streakSaves: number;
  lastDecayCheck: string;
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

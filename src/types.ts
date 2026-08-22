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

export interface CompletionEntry {
  id: string;
  habitId: string;
  date: string;
  xpAwarded: number;
  goldAwarded: number;
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

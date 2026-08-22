import type {
  AttributeKey,
  Attributes,
  BossVictory,
  CharacterState,
  CompletionEntry,
  Habit,
  RedemptionEntry,
  ReminderSettings,
  Reward,
} from '../types';
import { ATTRIBUTE_KEYS } from './rpg';
import { todayStr } from './date';

export interface BackupData {
  character: CharacterState;
  habits: Habit[];
  completions: CompletionEntry[];
  rewards: Reward[];
  redemptions: RedemptionEntry[];
  bossVictories: BossVictory[];
  settings?: ReminderSettings;
}

export type ParseResult = { ok: true; data: BackupData } | { ok: false; error: string };

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const finiteNum = (v: unknown, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;

const nullableDate = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 ? v : null);

function parseAttributes(raw: unknown): Attributes | null {
  if (!isObj(raw)) return null;
  const out = {} as Attributes;
  for (const key of ATTRIBUTE_KEYS) {
    const entry = raw[key];
    if (!isObj(entry)) return null;
    const level = finiteNum(entry.level, Number.NaN);
    const xp = finiteNum(entry.xp, Number.NaN);
    if (!Number.isFinite(level) || !Number.isFinite(xp)) return null;
    out[key] = { level: Math.max(1, Math.floor(level)), xp: Math.max(0, Math.floor(xp)) };
  }
  return out;
}

function parseCharacter(raw: unknown): CharacterState | null {
  if (!isObj(raw)) return null;
  const attributes = parseAttributes(raw.attributes);
  if (!attributes) return null;
  return {
    name: typeof raw.name === 'string' ? raw.name.slice(0, 24) : '',
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
    attributes,
    gold: Math.max(0, Math.floor(finiteNum(raw.gold, 0))),
    streakSaves: Math.max(0, Math.floor(finiteNum(raw.streakSaves, 0))),
    lastDecayCheck: typeof raw.lastDecayCheck === 'string' ? raw.lastDecayCheck : todayStr(),
  };
}

function parseFrequency(raw: unknown): Habit['frequency'] | null {
  if (!isObj(raw)) return null;
  if (raw.type === 'daily') return { type: 'daily' };
  if (raw.type === 'weekly' && Array.isArray(raw.days)) {
    const days = raw.days.filter(
      (d): d is number => typeof d === 'number' && Number.isInteger(d) && d >= 0 && d <= 6,
    );
    return { type: 'weekly', days };
  }
  return null;
}

function parseHabit(raw: unknown): Habit | null {
  if (!isObj(raw)) return null;
  if (typeof raw.id !== 'string' || typeof raw.name !== 'string') return null;
  if (typeof raw.attribute !== 'string' || !ATTRIBUTE_KEYS.includes(raw.attribute as AttributeKey)) return null;
  const frequency = parseFrequency(raw.frequency);
  if (!frequency) return null;

  return {
    id: raw.id,
    name: raw.name.slice(0, 60),
    attribute: raw.attribute as AttributeKey,
    frequency,
    graceDays: Math.max(0, Math.floor(finiteNum(raw.graceDays, 2))),
    xpReward: Math.max(1, Math.floor(finiteNum(raw.xpReward, 10))),
    streak: Math.max(0, Math.floor(finiteNum(raw.streak, 0))),
    bestStreak: Math.max(0, Math.floor(finiteNum(raw.bestStreak, 0))),
    lastCompletedDate: nullableDate(raw.lastCompletedDate),
    decayedThroughDate: nullableDate(raw.decayedThroughDate),
    missedSinceCompletion: Math.max(0, Math.floor(finiteNum(raw.missedSinceCompletion, 0))),
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
    archived: raw.archived === true,
  };
}

function parseCompletion(raw: unknown): CompletionEntry | null {
  if (!isObj(raw)) return null;
  if (typeof raw.id !== 'string' || typeof raw.habitId !== 'string' || typeof raw.date !== 'string') return null;
  const xpAwarded = Math.max(0, Math.floor(finiteNum(raw.xpAwarded, 0)));
  const entry: CompletionEntry = {
    id: raw.id,
    habitId: raw.habitId,
    date: raw.date,
    xpAwarded,
    goldAwarded: Math.max(0, Math.floor(finiteNum(raw.goldAwarded, xpAwarded))),
  };
  const prev = raw.prevProgress;
  if (isObj(prev)) {
    entry.prevProgress = {
      streak: Math.max(0, Math.floor(finiteNum(prev.streak, 0))),
      bestStreak: Math.max(0, Math.floor(finiteNum(prev.bestStreak, 0))),
      missedSinceCompletion: Math.max(0, Math.floor(finiteNum(prev.missedSinceCompletion, 0))),
      lastCompletedDate: nullableDate(prev.lastCompletedDate),
      decayedThroughDate: nullableDate(prev.decayedThroughDate),
    };
  }
  return entry;
}

function parseReward(raw: unknown): Reward | null {
  if (!isObj(raw)) return null;
  if (typeof raw.id !== 'string' || typeof raw.name !== 'string') return null;
  return {
    id: raw.id,
    name: raw.name.slice(0, 60),
    cost: Math.max(1, Math.floor(finiteNum(raw.cost, 10))),
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
  };
}

function parseRedemption(raw: unknown): RedemptionEntry | null {
  if (!isObj(raw)) return null;
  if (typeof raw.id !== 'string' || typeof raw.rewardName !== 'string' || typeof raw.date !== 'string') return null;
  return {
    id: raw.id,
    rewardId: typeof raw.rewardId === 'string' ? raw.rewardId : '',
    rewardName: raw.rewardName.slice(0, 60),
    cost: Math.max(0, Math.floor(finiteNum(raw.cost, 0))),
    date: raw.date,
  };
}

function parseBossVictory(raw: unknown): BossVictory | null {
  if (!isObj(raw)) return null;
  if (typeof raw.id !== 'string' || typeof raw.weekStart !== 'string' || typeof raw.bossName !== 'string') return null;
  return {
    id: raw.id,
    weekStart: raw.weekStart,
    bossName: raw.bossName.slice(0, 60),
    xpEarned: Math.max(0, Math.floor(finiteNum(raw.xpEarned, 0))),
    threshold: Math.max(0, Math.floor(finiteNum(raw.threshold, 0))),
    goldReward: Math.max(0, Math.floor(finiteNum(raw.goldReward, 0))),
    defeatedAt: typeof raw.defeatedAt === 'string' ? raw.defeatedAt : new Date().toISOString(),
  };
}

function parseSettings(raw: unknown): ReminderSettings | undefined {
  if (!isObj(raw)) return undefined;
  const time = typeof raw.time === 'string' && /^\d{2}:\d{2}$/.test(raw.time) ? raw.time : '19:00';
  return {
    enabled: raw.enabled === true,
    time,
    lastNotifiedDate: nullableDate(raw.lastNotifiedDate),
  };
}

/** Rows that fail validation are dropped rather than failing the whole import. */
function parseList<T>(raw: unknown, parse: (item: unknown) => T | null): T[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(parse).filter((v): v is T => v !== null);
}

/**
 * Validates an exported backup end to end. Nothing is written to the store
 * unless this returns ok — a half-valid file that got applied would leave
 * the app in a state it cannot render, and since that state is persisted
 * immediately, the user would be stuck in a crash loop with no way to reach
 * Settings to recover.
 */
export function parseBackup(json: string): ParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, error: "Could not read this file — it isn't valid JSON." };
  }

  if (!isObj(parsed)) {
    return { ok: false, error: "This file doesn't look like a Questlog backup." };
  }

  const character = parseCharacter(parsed.character);
  if (!character) {
    return {
      ok: false,
      error: "This backup is missing or has a damaged character record, so it can't be restored.",
    };
  }

  if (!Array.isArray(parsed.habits)) {
    return { ok: false, error: "This backup has no quest list, so it can't be restored." };
  }
  const habits = parseList(parsed.habits, parseHabit);
  if (habits.length === 0 && parsed.habits.length > 0) {
    return { ok: false, error: 'Every quest in this backup is damaged, so it was not restored.' };
  }

  return {
    ok: true,
    data: {
      character,
      habits,
      completions: parseList(parsed.completions, parseCompletion),
      rewards: parseList(parsed.rewards, parseReward),
      redemptions: parseList(parsed.redemptions, parseRedemption),
      bossVictories: parseList(parsed.bossVictories, parseBossVictory),
      settings: parseSettings(parsed.settings),
    },
  };
}

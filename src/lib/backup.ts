import type {
  AttributeKey,
  Attributes,
  BossVictory,
  CharacterState,
  CheatDayState,
  Cosmetics,
  Inventory,
  CompletionEntry,
  Habit,
  RedemptionEntry,
  ReminderSettings,
  Reward,
  Vacation,
} from '../types';
import { ATTRIBUTE_KEYS, SIGNATURE_LEVEL } from './rpg';
import {
  COSMETIC_RINGS,
  COSMETIC_TITLES,
  inferRewardTier,
  REWARD_TIER_ORDER,
  type RewardTier,
} from './shop';
import { todayStr } from './date';
import { isValidGearId, withEquipped } from './gear';
import { daysInclusive, MAX_VACATION_DAYS } from './vacation';

export interface BackupData {
  character: CharacterState;
  habits: Habit[];
  completions: CompletionEntry[];
  rewards: Reward[];
  redemptions: RedemptionEntry[];
  bossVictories: BossVictory[];
  vacations: Vacation[];
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

function parseCheatDay(raw: unknown, conLevel: number): CheatDayState {
  const unlockedByLevel = conLevel >= SIGNATURE_LEVEL;
  if (!isObj(raw)) {
    // Backup predates the perk: rebuild from the level it records.
    return {
      unlocked: unlockedByLevel,
      charges: unlockedByLevel ? 1 : 0,
      progressToNext: 0,
      usedDates: [],
    };
  }
  return {
    unlocked: raw.unlocked === true || unlockedByLevel,
    charges: Math.min(1, Math.max(0, Math.floor(finiteNum(raw.charges, 0)))),
    progressToNext: Math.max(0, Math.floor(finiteNum(raw.progressToNext, 0))),
    usedDates: Array.isArray(raw.usedDates)
      ? raw.usedDates.filter((d): d is string => typeof d === 'string')
      : [],
  };
}

function parseInventory(raw: unknown): Inventory {
  if (!isObj(raw)) return { restDayTokens: 0, phoenixFeathers: 0, elixirCompletions: 0 };
  return {
    restDayTokens: Math.max(0, Math.floor(finiteNum(raw.restDayTokens, 0))),
    phoenixFeathers: Math.max(0, Math.floor(finiteNum(raw.phoenixFeathers, 0))),
    elixirCompletions: Math.max(0, Math.floor(finiteNum(raw.elixirCompletions, 0))),
  };
}

function parseCosmetics(raw: unknown): Cosmetics {
  const empty: Cosmetics = {
    unlockedTitles: [],
    unlockedRings: [],
    activeTitle: null,
    activeRing: null,
    unlockedGear: [],
    equippedGear: [],
  };
  if (!isObj(raw)) return empty;
  // Only ids that exist in the current catalog survive, so a hand-edited
  // backup can't inject an unknown title or ring.
  const titleIds = new Set(COSMETIC_TITLES.map((c) => c.id));
  const ringIds = new Set(COSMETIC_RINGS.map((c) => c.id));
  const known = (v: unknown, valid: Set<string>) =>
    Array.isArray(v) ? v.filter((id): id is string => typeof id === 'string' && valid.has(id)) : [];

  const unlockedTitles = known(raw.unlockedTitles, titleIds);
  const unlockedRings = known(raw.unlockedRings, ringIds);
  const active = (v: unknown, owned: string[]) =>
    typeof v === 'string' && owned.includes(v) ? v : null;

  // Same rule for gear: unknown ids are dropped, and you can't wear a piece
  // the backup doesn't also claim you own.
  const unlockedGear = Array.isArray(raw.unlockedGear) ? raw.unlockedGear.filter(isValidGearId) : [];
  const equippedGear = Array.isArray(raw.equippedGear)
    ? raw.equippedGear.filter((id): id is string => isValidGearId(id) && unlockedGear.includes(id))
    : [];

  return {
    unlockedTitles,
    unlockedRings,
    activeTitle: active(raw.activeTitle, unlockedTitles),
    activeRing: active(raw.activeRing, unlockedRings),
    unlockedGear,
    // One piece per slot per class, whatever the file says.
    equippedGear: equippedGear.reduce<string[]>((acc, id) => withEquipped(acc, id), []),
  };
}

function parseCharacter(raw: unknown, completions: unknown): CharacterState | null {
  if (!isObj(raw)) return null;
  const attributes = parseAttributes(raw.attributes);
  if (!attributes) return null;

  // Older backups have no lifetimeXp — reconstruct it from the completion
  // log so an import doesn't silently reset the character's level.
  const lifetimeXp =
    typeof raw.lifetimeXp === 'number' && Number.isFinite(raw.lifetimeXp)
      ? Math.max(0, Math.floor(raw.lifetimeXp))
      : Array.isArray(completions)
        ? completions.reduce<number>(
            (sum, c) => sum + (isObj(c) ? Math.max(0, finiteNum(c.xpAwarded, 0)) : 0),
            0,
          )
        : 0;

  return {
    name: typeof raw.name === 'string' ? raw.name.slice(0, 24) : '',
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
    attributes,
    gold: Math.max(0, Math.floor(finiteNum(raw.gold, 0))),
    streakSaves: Math.max(0, Math.floor(finiteNum(raw.streakSaves, 0))),
    lifetimeXp,
    cheatDay: parseCheatDay(raw.cheatDay, attributes.CON.level),
    inventory: parseInventory(raw.inventory),
    cosmetics: parseCosmetics(raw.cosmetics),
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
  // Clamped to the awarded figure: base XP is what the quest was worth before
  // multipliers, so it can never exceed what was actually paid out, and a
  // hand-edited file must not be able to inflate boss progress.
  if (raw.backfilled === true) entry.backfilled = true;
  if (raw.baseXp !== undefined) {
    entry.baseXp = Math.min(xpAwarded, Math.max(0, Math.floor(finiteNum(raw.baseXp, 0))));
  }
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
  // Backups written before tiered pricing carry a free-form cost; map it onto
  // the closest tier rather than trusting a number the player could have set.
  const tier: RewardTier =
    typeof raw.tier === 'string' && REWARD_TIER_ORDER.includes(raw.tier as RewardTier)
      ? (raw.tier as RewardTier)
      : inferRewardTier(finiteNum(raw.cost, 0));
  return {
    id: raw.id,
    name: raw.name.slice(0, 60),
    tier,
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
    kind: raw.kind === 'utility' || raw.rewardId === 'streak-save' ? 'utility' : 'reward',
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

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseVacation(raw: unknown): Vacation | null {
  if (!isObj(raw)) return null;
  if (typeof raw.id !== 'string') return null;
  const { startDate, endDate } = raw;
  if (typeof startDate !== 'string' || !DATE_RE.test(startDate)) return null;
  if (typeof endDate !== 'string' || !DATE_RE.test(endDate)) return null;
  if (endDate < startDate) return null;
  // Reject a hand-edited range longer than the rules allow, rather than
  // importing a vacation that would forgive months of decay.
  if (daysInclusive(startDate, endDate) > MAX_VACATION_DAYS) return null;

  const endedEarlyOn =
    typeof raw.endedEarlyOn === 'string' && DATE_RE.test(raw.endedEarlyOn) ? raw.endedEarlyOn : undefined;

  return {
    id: raw.id,
    startDate,
    endDate,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
    ...(endedEarlyOn ? { endedEarlyOn } : {}),
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

  const character = parseCharacter(parsed.character, parsed.completions);
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
      vacations: parseList(parsed.vacations, parseVacation),
      settings: parseSettings(parsed.settings),
    },
  };
}

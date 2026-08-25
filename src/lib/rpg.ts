import type { AttributeKey, AttributeState, Attributes, Habit } from '../types';
import { addDays, dayOfWeek } from './date';

export const ATTRIBUTE_KEYS: AttributeKey[] = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];

export const ATTRIBUTE_INFO: Record<AttributeKey, { label: string; description: string; color: string }> = {
  STR: { label: 'Strength', description: 'Physical training, exercise, exertion', color: 'var(--color-blood-500)' },
  DEX: { label: 'Dexterity', description: 'Skill practice, coordination, agility', color: 'var(--color-verdant-500)' },
  CON: { label: 'Constitution', description: 'Health, sleep, nutrition, endurance', color: 'var(--color-gold-500)' },
  INT: { label: 'Intelligence', description: 'Study, reading, learning, focus work', color: 'var(--color-mana-500)' },
  WIS: { label: 'Wisdom', description: 'Mindfulness, reflection, discipline', color: '#9b7fd4' },
  CHA: { label: 'Charisma', description: 'Social habits, connection, creativity', color: '#e07bb0' },
};

export const CLASS_BY_ATTRIBUTE: Record<AttributeKey, string> = {
  STR: 'Warrior',
  DEX: 'Rogue',
  CON: 'Guardian',
  INT: 'Wizard',
  WIS: 'Cleric',
  CHA: 'Bard',
};

const BASE_XP = 100;
const XP_GROWTH = 40;
/** A missed day past grace costs this share of what the quest pays. */
export const DECAY_REWARD_FRACTION = 0.5;

export function xpToNextLevel(level: number): number {
  return BASE_XP + (level - 1) * XP_GROWTH;
}

export function createAttributes(): Attributes {
  return ATTRIBUTE_KEYS.reduce((acc, key) => {
    acc[key] = { level: 1, xp: 0 };
    return acc;
  }, {} as Attributes);
}

export function addXp(attr: AttributeState, amount: number): AttributeState {
  let { level, xp } = attr;
  xp += amount;
  while (xp >= xpToNextLevel(level)) {
    xp -= xpToNextLevel(level);
    level += 1;
  }
  return { level, xp };
}

export function removeXp(attr: AttributeState, amount: number): AttributeState {
  let { level, xp } = attr;
  xp -= amount;
  while (xp < 0) {
    if (level <= 1) {
      xp = 0;
      level = 1;
      break;
    }
    level -= 1;
    xp += xpToNextLevel(level);
  }
  return { level, xp };
}

const CHAR_BASE_XP = 150;
const CHAR_GROWTH = 100;

/** XP needed to advance from `level` to `level + 1`. */
export function xpForCharacterLevel(level: number): number {
  return CHAR_BASE_XP + (level - 1) * CHAR_GROWTH;
}

export interface CharacterProgress {
  level: number;
  xpIntoLevel: number;
  xpForNext: number;
}

/**
 * Character level runs off total lifetime XP rather than the average of the
 * six attributes. Averaging meant a focused player needed roughly 1,200 XP
 * (~60 days of a daily quest) to move the headline number by one, because
 * five untouched attributes dragged the average down.
 */
export function getCharacterProgress(lifetimeXp: number): CharacterProgress {
  let level = 1;
  let remaining = Math.max(0, lifetimeXp);
  while (remaining >= xpForCharacterLevel(level)) {
    remaining -= xpForCharacterLevel(level);
    level += 1;
  }
  return { level, xpIntoLevel: remaining, xpForNext: xpForCharacterLevel(level) };
}

const CLASS_PRIORITY: AttributeKey[] = ['STR', 'INT', 'DEX', 'WIS', 'CHA', 'CON'];

export function getCharacterClass(attributes: Attributes): { attribute: AttributeKey; className: string } {
  let best = CLASS_PRIORITY[0];
  let bestLevel = -1;
  for (const key of CLASS_PRIORITY) {
    if (attributes[key].level > bestLevel) {
      bestLevel = attributes[key].level;
      best = key;
    }
  }
  return { attribute: best, className: CLASS_BY_ATTRIBUTE[best] };
}

export function isScheduledDay(habit: Habit, dateStr: string): boolean {
  if (habit.frequency.type === 'daily') return true;
  return habit.frequency.days.includes(dayOfWeek(dateStr));
}

export interface DecayResult {
  habit: Habit;
  xpLoss: number;
}

export interface DecayOptions {
  /** Grace days including perk bonuses. */
  graceDays: number;
  /** XP lost per missed day past grace, already adjusted for perks. */
  perMiss: number;
  /** Days forgiven by a spent Cheat Day charge — skipped entirely. */
  forgivenDates?: readonly string[];
}

/**
 * Walks forward day-by-day from the habit's last processed date up to
 * (but not including) today, breaking the streak on the first missed
 * scheduled occurrence and accumulating attribute decay once the grace
 * period of missed occurrences has been exceeded.
 */
export function processHabitDecay(habit: Habit, today: string, options: DecayOptions): DecayResult {
  if (habit.archived) return { habit, xpLoss: 0 };

  const start = habit.decayedThroughDate ?? habit.lastCompletedDate ?? habit.createdAt.slice(0, 10);
  if (start >= today) return { habit, xpLoss: 0 };

  const forgiven = options.forgivenDates ?? [];
  let cursor = addDays(start, 1);
  let missed = habit.missedSinceCompletion;
  let streak = habit.streak;
  let xpLoss = 0;

  let brokenStreak = habit.lastBrokenStreak;
  while (cursor < today) {
    // A forgiven day never counts as missed, so the streak survives it too.
    if (isScheduledDay(habit, cursor) && !forgiven.includes(cursor)) {
      missed += 1;
      if (missed === 1) {
        // Remember how long it was, so a Phoenix Feather can put it back.
        if (streak > 0) brokenStreak = streak;
        streak = 0;
      }
      if (missed > options.graceDays) {
        xpLoss += options.perMiss;
      }
    }
    cursor = addDays(cursor, 1);
  }

  return {
    habit: {
      ...habit,
      missedSinceCompletion: missed,
      streak,
      lastBrokenStreak: brokenStreak,
      decayedThroughDate: addDays(today, -1),
    },
    xpLoss,
  };
}

export const GOLD_PER_XP = 1;
export const STREAK_SAVE_COST = 120;

export interface Tier {
  name: string;
  ring: string;
}

export function getTier(level: number): Tier {
  if (level >= 20) return { name: 'Platinum', ring: '#d9ecff' };
  if (level >= 10) return { name: 'Gold', ring: 'var(--color-gold-400)' };
  if (level >= 5) return { name: 'Silver', ring: '#c7d0da' };
  return { name: 'Bronze', ring: '#b08d57' };
}

export type SignatureId = 'berserker' | 'momentum' | 'cheat-day' | 'deep-work' | 'equanimity' | 'patron';

/** The level at which every attribute grants its one-of-a-kind signature perk. */
export const SIGNATURE_LEVEL = 6;

export interface Perk {
  level: number;
  name: string;
  description: string;
  /** Present only on the signature perk — its effect is bespoke, not a stat tweak. */
  signature?: SignatureId;
}

const GRACE_PERK_LEVELS = [3, 15];
const XP_PERK_LEVEL = 10;
const GOLD_PERK_LEVEL = 20;

export const XP_PERK_BONUS = 0.1;
export const GOLD_PERK_BONUS = 0.25;

/** Signature perk tuning, kept together so the numbers are easy to find and adjust. */
export const BERSERKER_INTERVAL = 7;
export const BERSERKER_MULTIPLIER = 2;
export const MOMENTUM_PER_STREAK_DAY = 0.02;
export const MOMENTUM_CAP = 0.5;
export const DEEP_WORK_SPILL = 0.1;
export const EQUANIMITY_DECAY_REDUCTION = 0.25;
export const PATRON_GOLD_BONUS = 0.25;
export const CHEAT_DAY_RECHARGE_COMPLETIONS = 30;
export const ELIXIR_XP_MULTIPLIER = 2;

export const PERKS: Record<AttributeKey, Perk[]> = {
  STR: [
    { level: 3, name: 'Steady Grip', description: '+1 day of grace before Strength quests decay.' },
    {
      level: SIGNATURE_LEVEL,
      name: 'Berserker',
      signature: 'berserker',
      description: `Every ${BERSERKER_INTERVAL}th day of a streak, a Strength quest pays double XP.`,
    },
    { level: 10, name: 'Battle-Hardened', description: '+10% XP from Strength quests.' },
    { level: 15, name: 'Juggernaut', description: '+1 more day of grace before Strength quests decay.' },
    { level: 20, name: 'Legendary Warrior', description: '+25% gold from Strength quests.' },
  ],
  DEX: [
    { level: 3, name: 'Light Feet', description: '+1 day of grace before Dexterity quests decay.' },
    {
      level: SIGNATURE_LEVEL,
      name: 'Momentum',
      signature: 'momentum',
      description: 'Dexterity quests pay +2% XP per day of streak, up to +50%.',
    },
    { level: 10, name: 'Practiced Precision', description: '+10% XP from Dexterity quests.' },
    { level: 15, name: 'Shadow Step', description: '+1 more day of grace before Dexterity quests decay.' },
    { level: 20, name: 'Master of Motion', description: '+25% gold from Dexterity quests.' },
  ],
  CON: [
    { level: 3, name: 'Early Riser', description: '+1 day of grace before Constitution quests decay.' },
    {
      level: SIGNATURE_LEVEL,
      name: 'Cheat Day',
      signature: 'cheat-day',
      description: `Spend a charge for a full rest day — every quest due that day is forgiven, with no decay and streaks intact. Recharges after ${CHEAT_DAY_RECHARGE_COMPLETIONS} completions.`,
    },
    { level: 10, name: 'Unshakable', description: '+10% XP from Constitution quests.' },
    { level: 15, name: 'Bastion', description: '+1 more day of grace before Constitution quests decay.' },
    { level: 20, name: 'Undying Guardian', description: '+25% gold from Constitution quests.' },
  ],
  INT: [
    { level: 3, name: 'Curious Mind', description: '+1 day of grace before Intelligence quests decay.' },
    {
      level: SIGNATURE_LEVEL,
      name: 'Deep Work',
      signature: 'deep-work',
      description: 'Intelligence quests also give every other attribute 10% of their XP.',
    },
    { level: 10, name: 'Sharp Focus', description: '+10% XP from Intelligence quests.' },
    { level: 15, name: 'Arcane Scholar', description: '+1 more day of grace before Intelligence quests decay.' },
    { level: 20, name: 'Archmage', description: '+25% gold from Intelligence quests.' },
  ],
  WIS: [
    { level: 3, name: 'Mindful Pause', description: '+1 day of grace before Wisdom quests decay.' },
    {
      level: SIGNATURE_LEVEL,
      name: 'Equanimity',
      signature: 'equanimity',
      description: 'All decay, on every attribute, is reduced by 25%.',
    },
    { level: 10, name: 'Clear Sight', description: '+10% XP from Wisdom quests.' },
    { level: 15, name: 'Serene Discipline', description: '+1 more day of grace before Wisdom quests decay.' },
    { level: 20, name: 'Enlightened', description: '+25% gold from Wisdom quests.' },
  ],
  CHA: [
    { level: 3, name: 'Warm Presence', description: '+1 day of grace before Charisma quests decay.' },
    {
      level: SIGNATURE_LEVEL,
      name: 'Patron',
      signature: 'patron',
      description: 'Every quest, on every attribute, pays +25% gold.',
    },
    { level: 10, name: 'Silver Tongue', description: '+10% XP from Charisma quests.' },
    { level: 15, name: 'Magnetic', description: '+1 more day of grace before Charisma quests decay.' },
    { level: 20, name: 'Legendary Bard', description: '+25% gold from Charisma quests.' },
  ],
};

export function getUnlockedPerks(attribute: AttributeKey, level: number): Perk[] {
  return PERKS[attribute].filter((p) => p.level <= level);
}

export function getNextPerk(attribute: AttributeKey, level: number): Perk | null {
  return PERKS[attribute].find((p) => p.level > level) ?? null;
}

/** Perks whose threshold sits in (oldLevel, newLevel] — used to fire unlock celebrations. */
export function getCrossedPerks(attribute: AttributeKey, oldLevel: number, newLevel: number): Perk[] {
  if (newLevel <= oldLevel) return [];
  return PERKS[attribute].filter((p) => p.level > oldLevel && p.level <= newLevel);
}

/** True once the attribute that owns this signature has reached its level. */
export function hasSignature(attributes: Attributes, id: SignatureId): boolean {
  for (const key of ATTRIBUTE_KEYS) {
    const perk = PERKS[key].find((p) => p.signature === id);
    if (perk) return attributes[key].level >= perk.level;
  }
  return false;
}

export interface AttributePerkBonuses {
  graceDays: number;
  xpMultiplier: number;
  goldMultiplier: number;
}

/** The stackable, non-signature bonuses an attribute has unlocked at `level`. */
export function getAttributeBonuses(attribute: AttributeKey, level: number): AttributePerkBonuses {
  const unlocked = getUnlockedPerks(attribute, level);
  return {
    graceDays: unlocked.filter((p) => GRACE_PERK_LEVELS.includes(p.level)).length,
    xpMultiplier: unlocked.some((p) => p.level === XP_PERK_LEVEL) ? 1 + XP_PERK_BONUS : 1,
    goldMultiplier: unlocked.some((p) => p.level === GOLD_PERK_LEVEL) ? 1 + GOLD_PERK_BONUS : 1,
  };
}

/** Grace days a habit effectively gets: its own setting plus perk bonuses. */
export function getEffectiveGraceDays(habit: Habit, attributes: Attributes): number {
  return habit.graceDays + getAttributeBonuses(habit.attribute, attributes[habit.attribute].level).graceDays;
}

export interface CompletionAward {
  xp: number;
  /** The quest's face value, before every multiplier. The boss scores in this. */
  baseXp: number;
  gold: number;
  /** XP spilled to every other attribute by Deep Work. */
  spilloverXp: number;
  doubled: boolean;
  /** True when an Elixir of Might charge was consumed for this completion. */
  elixirUsed: boolean;
}

/**
 * XP and gold for completing `habit`, with every perk applied.
 * `newStreak` is the streak the completion will produce (0 for an
 * off-schedule completion, which earns rewards but no streak credit).
 */
export function getCompletionAward(
  habit: Habit,
  attributes: Attributes,
  newStreak: number,
  elixirActive = false,
): CompletionAward {
  const bonuses = getAttributeBonuses(habit.attribute, attributes[habit.attribute].level);
  let xpMultiplier = bonuses.xpMultiplier;
  let doubled = false;

  if (
    habit.attribute === 'STR' &&
    hasSignature(attributes, 'berserker') &&
    newStreak > 0 &&
    newStreak % BERSERKER_INTERVAL === 0
  ) {
    xpMultiplier *= BERSERKER_MULTIPLIER;
    doubled = true;
  }

  if (habit.attribute === 'DEX' && hasSignature(attributes, 'momentum')) {
    xpMultiplier *= 1 + Math.min(MOMENTUM_CAP, Math.max(0, newStreak) * MOMENTUM_PER_STREAK_DAY);
  }

  const xpBeforeElixir = Math.max(1, Math.round(habit.xpReward * xpMultiplier));

  // Gold is deliberately based on the pre-elixir figure. If an Elixir also
  // doubled gold it could out-earn its own price, turning the shop into a
  // money printer.
  let goldMultiplier = bonuses.goldMultiplier;
  if (hasSignature(attributes, 'patron')) goldMultiplier *= 1 + PATRON_GOLD_BONUS;
  const gold = Math.max(0, Math.round(xpBeforeElixir * GOLD_PER_XP * goldMultiplier));

  const xp = elixirActive ? xpBeforeElixir * ELIXIR_XP_MULTIPLIER : xpBeforeElixir;

  const spilloverXp =
    habit.attribute === 'INT' && hasSignature(attributes, 'deep-work')
      ? Math.floor(xp * DEEP_WORK_SPILL)
      : 0;

  return { xp, baseXp: habit.xpReward, gold, spilloverXp, doubled, elixirUsed: elixirActive };
}

/**
 * XP lost per missed day past the grace period. Scales with the habit's own
 * reward — a flat rate meant a 5 XP quest bled more than it could ever earn,
 * while a 50 XP quest barely noticed.
 */
export function getDecayPerMiss(habit: Habit, attributes: Attributes): number {
  let perMiss = habit.xpReward * DECAY_REWARD_FRACTION;
  if (hasSignature(attributes, 'equanimity')) perMiss *= 1 - EQUANIMITY_DECAY_REDUCTION;
  return Math.max(1, Math.round(perMiss));
}

export function isDecaying(habit: Habit, attributes?: Attributes): boolean {
  if (habit.archived) return false;
  const grace = attributes ? getEffectiveGraceDays(habit, attributes) : habit.graceDays;
  return habit.missedSinceCompletion > grace;
}

export function isAtRisk(habit: Habit, attributes?: Attributes): boolean {
  if (habit.archived) return false;
  const grace = attributes ? getEffectiveGraceDays(habit, attributes) : habit.graceDays;
  return habit.missedSinceCompletion > 0 && habit.missedSinceCompletion <= grace;
}

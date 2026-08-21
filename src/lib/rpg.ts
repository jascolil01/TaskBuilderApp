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
export const DECAY_XP_PER_MISS = 12;

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

export function getCharacterLevel(attributes: Attributes): number {
  const levels = ATTRIBUTE_KEYS.map((k) => attributes[k].level);
  return Math.max(1, Math.floor(levels.reduce((a, b) => a + b, 0) / levels.length));
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

/**
 * Walks forward day-by-day from the habit's last processed date up to
 * (but not including) today, breaking the streak on the first missed
 * scheduled occurrence and accumulating attribute decay once the grace
 * period of missed occurrences has been exceeded.
 */
export function processHabitDecay(habit: Habit, today: string): DecayResult {
  if (habit.archived) return { habit, xpLoss: 0 };

  const start = habit.decayedThroughDate ?? habit.lastCompletedDate ?? habit.createdAt.slice(0, 10);
  if (start >= today) return { habit, xpLoss: 0 };

  let cursor = addDays(start, 1);
  let missed = habit.missedSinceCompletion;
  let streak = habit.streak;
  let xpLoss = 0;

  while (cursor < today) {
    if (isScheduledDay(habit, cursor)) {
      missed += 1;
      if (missed === 1) streak = 0;
      if (missed > habit.graceDays) {
        xpLoss += DECAY_XP_PER_MISS;
      }
    }
    cursor = addDays(cursor, 1);
  }

  return {
    habit: {
      ...habit,
      missedSinceCompletion: missed,
      streak,
      decayedThroughDate: addDays(today, -1),
    },
    xpLoss,
  };
}

export const GOLD_PER_XP = 1;

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

export function isDecaying(habit: Habit): boolean {
  return !habit.archived && habit.missedSinceCompletion > habit.graceDays;
}

export function isAtRisk(habit: Habit): boolean {
  return !habit.archived && habit.missedSinceCompletion > 0 && habit.missedSinceCompletion <= habit.graceDays;
}

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

export interface Perk {
  level: number;
  name: string;
  description: string;
}

export const PERKS: Record<AttributeKey, Perk[]> = {
  STR: [
    { level: 3, name: 'Steady Grip', description: 'Physical habits start to feel a little easier.' },
    { level: 6, name: 'Iron Sinew', description: 'Your training compounds — every workout hits harder.' },
    { level: 10, name: 'Battle-Hardened', description: 'Recognized as someone who trains seriously.' },
    { level: 15, name: 'Juggernaut', description: 'Raw physical power, hard to knock down.' },
    { level: 20, name: 'Legendary Warrior', description: 'Your strength has become the stuff of legend.' },
  ],
  DEX: [
    { level: 3, name: 'Light Feet', description: 'New skills click a little faster.' },
    { level: 6, name: 'Quick Hands', description: 'Practiced reflexes start to show.' },
    { level: 10, name: 'Practiced Precision', description: 'Consistency has sharpened your technique.' },
    { level: 15, name: 'Shadow Step', description: 'You move through routines with total ease.' },
    { level: 20, name: 'Master of Motion', description: 'Elite-level coordination and control.' },
  ],
  CON: [
    { level: 3, name: 'Early Riser', description: 'Healthy routines are starting to stick.' },
    { level: 6, name: 'Iron Stomach', description: 'Your habits have built real resilience.' },
    { level: 10, name: 'Unshakable', description: 'Hard to knock off your routine now.' },
    { level: 15, name: 'Bastion', description: 'A foundation of health others can lean on.' },
    { level: 20, name: 'Undying Guardian', description: 'Endurance that borders on legendary.' },
  ],
  INT: [
    { level: 3, name: 'Curious Mind', description: 'Learning is starting to become a habit.' },
    { level: 6, name: 'Well-Read', description: 'Your knowledge base is visibly growing.' },
    { level: 10, name: 'Sharp Focus', description: 'Deep work comes easier than it used to.' },
    { level: 15, name: 'Arcane Scholar', description: 'A genuine expert in the making.' },
    { level: 20, name: 'Archmage', description: 'Mastery of knowledge few ever reach.' },
  ],
  WIS: [
    { level: 3, name: 'Mindful Pause', description: 'Reflection is becoming second nature.' },
    { level: 6, name: 'Inner Calm', description: 'Discipline is steadying your days.' },
    { level: 10, name: 'Clear Sight', description: 'Better judgment, born from practice.' },
    { level: 15, name: 'Serene Discipline', description: 'Composure that rarely cracks.' },
    { level: 20, name: 'Enlightened', description: 'A rare, hard-won clarity of mind.' },
  ],
  CHA: [
    { level: 3, name: 'Warm Presence', description: 'Connection is coming more naturally.' },
    { level: 6, name: 'Easy Rapport', description: 'People notice your growing confidence.' },
    { level: 10, name: 'Silver Tongue', description: 'Your words carry real weight now.' },
    { level: 15, name: 'Magnetic', description: 'A presence that draws people in.' },
    { level: 20, name: 'Legendary Bard', description: 'Charisma that becomes the stuff of stories.' },
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

export function isDecaying(habit: Habit): boolean {
  return !habit.archived && habit.missedSinceCompletion > habit.graceDays;
}

export function isAtRisk(habit: Habit): boolean {
  return !habit.archived && habit.missedSinceCompletion > 0 && habit.missedSinceCompletion <= habit.graceDays;
}

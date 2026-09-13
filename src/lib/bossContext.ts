import type { Attributes, Habit } from '../types';
import { type BossContext, type BossModifier, getBossForWeek } from './boss';
import { ATTRIBUTE_KEYS } from './rpg';

/**
 * The modifier and context for a week, built the same way everywhere.
 *
 * This exists because of a bug that has already been fixed once: the boss card
 * and the store each computed the target from slightly different inputs, and
 * the screen showed 252 while the store had frozen 180. A modifier multiplies
 * the number of inputs that have to agree, so there is exactly one place that
 * assembles them.
 */
export function getBossSetup(
  weekStart: string,
  attributes: Attributes,
): { modifier: BossModifier; ctx: BossContext } {
  const boss = getBossForWeek(weekStart);
  const levels = Object.fromEntries(ATTRIBUTE_KEYS.map((k) => [k, attributes[k].level]));
  return { modifier: boss.modifier, ctx: { levels } };
}

/** Completions indexed by quest, which the scoring rules need. */
export function indexHabits(habits: Habit[]): Map<string, Habit> {
  return new Map(habits.map((h) => [h.id, h]));
}

import type { AttributeKey, CompletionEntry, Habit } from '../types';
import { inferEffort } from './effort';
import { addDays, dayOfWeek } from './date';

/**
 * What a boss changes about its week.
 *
 * The rule is applied to the target and to the score in exactly the same
 * breath, so a modifier changes *what you focus on* rather than how hard the
 * week is. Doubling Strength doubles both the Strength part of the potential
 * and the Strength part of what you earn: keep your usual mix and the week is
 * as it was, lean into Strength and you clear it early, neglect it and you
 * won't clear it at all.
 *
 * A modifier that only touched the score would be a difficulty slider with a
 * costume on, which is not the same thing and is much less interesting.
 */
export interface BossModifier {
  id: string;
  /** One line, in the boss's voice. */
  rule: string;
  /**
   * Weight for one occurrence of `habit` on `date`. Anything but 1 must be
   * derivable from state that doesn't move during the week, or the frozen
   * target and the live score drift apart.
   */
  weight: (habit: Habit, date: string, ctx: BossContext) => number;
}

/** What the rules are allowed to look at. */
export interface BossContext {
  /** Attribute levels, for rules that key off your weakest. */
  levels?: Partial<Record<AttributeKey, number>>;
}

const DOUBLE = 2;

/** The attribute you're furthest behind on. Ties break alphabetically so it's stable. */
function weakestAttribute(levels: BossContext['levels']): AttributeKey | null {
  if (!levels) return null;
  const entries = Object.entries(levels) as [AttributeKey, number][];
  if (entries.length === 0) return null;
  return entries.sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))[0][0];
}

export interface Boss {
  name: string;
  color: string;
  modifier: BossModifier;
}

export const BOSS_ROSTER: Boss[] = [
  {
    name: 'Procrastination Wyrm',
    color: '#9b7fd4',
    modifier: {
      id: 'early',
      rule: 'Monday and Tuesday count double. Start the week, don\u2019t save it.',
      weight: (_h, date) => ([1, 2].includes(dayOfWeek(date)) ? DOUBLE : 1),
    },
  },
  {
    name: 'The Doubt Golem',
    color: '#b08d57',
    modifier: {
      id: 'weakest',
      rule: 'Your lowest attribute counts double. The one you doubt is the one that counts.',
      weight: (h, _date, ctx) => (h.attribute === weakestAttribute(ctx.levels) ? DOUBLE : 1),
    },
  },
  {
    name: 'Sloth Hydra',
    color: 'var(--color-verdant-500)',
    modifier: {
      id: 'weekend',
      rule: 'Saturday and Sunday count double. It grows a second head at the weekend.',
      weight: (_h, date) => ([0, 6].includes(dayOfWeek(date)) ? DOUBLE : 1),
    },
  },
  {
    name: 'Burnout Phoenix',
    color: 'var(--color-blood-500)',
    modifier: {
      id: 'constitution',
      rule: 'Constitution quests count double. You cannot outrun a body you never rested.',
      weight: (h) => (h.attribute === 'CON' ? DOUBLE : 1),
    },
  },
  {
    name: 'The Excuse Specter',
    color: 'var(--color-mana-500)',
    modifier: {
      id: 'small',
      rule: 'Quick and Short quests count double. There is no excuse left for a two-minute task.',
      weight: (h) => (['quick', 'short'].includes(h.effort ?? inferEffort(h.xpReward)) ? DOUBLE : 1),
    },
  },
  {
    name: 'Comfort Zone Dragon',
    color: '#e07bb0',
    modifier: {
      id: 'large',
      rule: 'Hard and Major quests count double. Only what stretches you counts here.',
      weight: (h) => (['hard', 'major'].includes(h.effort ?? inferEffort(h.xpReward)) ? DOUBLE : 1),
    },
  },
];

/** The Sunday that starts the week containing dateStr (week runs Sun–Sat). */
export function getWeekStart(dateStr: string): string {
  return addDays(dateStr, -dayOfWeek(dateStr));
}

export function getWeekEnd(weekStart: string): string {
  return addDays(weekStart, 6);
}

function weekIndex(weekStart: string): number {
  const [y, m, d] = weekStart.split('-').map(Number);
  const days = Math.floor(Date.UTC(y, m - 1, d) / 86400000);
  return Math.floor(days / 7);
}

export function getBossForWeek(weekStart: string): Boss {
  const idx = ((weekIndex(weekStart) % BOSS_ROSTER.length) + BOSS_ROSTER.length) % BOSS_ROSTER.length;
  return BOSS_ROSTER[idx];
}

/**
 * Scheduled occurrences of `habit` in the week, counted only from the day it
 * existed. A quest added on Friday can only be done twice that week, so
 * charging the boss bar for a full seven days of it would set a target the
 * player cannot reach.
 */
function occurrencesThisWeek(habit: Habit, weekStart: string, away?: ReadonlySet<string>): number {
  const created = habit.createdAt.slice(0, 10);
  const from = created > weekStart ? created : weekStart;
  const weekEnd = getWeekEnd(weekStart);
  if (from > weekEnd) return 0;

  let count = 0;
  for (let cursor = from; cursor <= weekEnd; cursor = addDays(cursor, 1)) {
    if (away?.has(cursor)) continue;
    if (habit.frequency.type === 'daily' || habit.frequency.days.includes(dayOfWeek(cursor))) count += 1;
  }
  return count;
}

export function getWeeklyXpPotential(
  habits: Habit[],
  weekStart: string,
  away?: ReadonlySet<string>,
  modifier?: BossModifier,
  ctx: BossContext = {},
): number {
  let total = 0;
  const weekEnd = getWeekEnd(weekStart);
  for (const h of habits) {
    if (h.archived) continue;
    if (!modifier) {
      total += h.xpReward * occurrencesThisWeek(h, weekStart, away);
      continue;
    }
    // With a modifier in play the days can't be collapsed into a count, since
    // a rule may weigh Tuesday differently from Thursday.
    const created = h.createdAt.slice(0, 10);
    const from = created > weekStart ? created : weekStart;
    for (let cursor = from; cursor <= weekEnd; cursor = addDays(cursor, 1)) {
      if (away?.has(cursor)) continue;
      if (h.frequency.type !== 'daily' && !h.frequency.days.includes(dayOfWeek(cursor))) continue;
      total += h.xpReward * modifier.weight(h, cursor, ctx);
    }
  }
  return total;
}

/** The floor before any vacation is taken into account. */
const MIN_THRESHOLD = 50;

export function getBossThreshold(
  habits: Habit[],
  weekStart: string,
  modifier?: BossModifier,
  ctx: BossContext = {},
): number {
  return Math.max(
    MIN_THRESHOLD,
    Math.round(getWeeklyXpPotential(habits, weekStart, undefined, modifier, ctx) * 0.6),
  );
}

/**
 * How much of the week you were actually around for, weighted by what was due
 * on those days — 1 when you were here all week, 0 when a vacation covered
 * every scheduled day of it.
 */
export function getPresentFraction(
  habits: Habit[],
  weekStart: string,
  away: ReadonlySet<string>,
  modifier?: BossModifier,
  ctx: BossContext = {},
): number {
  const full = getWeeklyXpPotential(habits, weekStart, undefined, modifier, ctx);
  if (full <= 0) return 1;
  return getWeeklyXpPotential(habits, weekStart, away, modifier, ctx) / full;
}

/**
 * This week's target. The frozen value is a floor, never a ceiling: freezing
 * stops a player archiving a quest mid-week to duck under a bar they'd already
 * missed, but it must not pin a brand-new character to a target set from the
 * three starter quests they had before adding six more.
 */
export function resolveBossThreshold(
  habits: Habit[],
  weekStart: string,
  frozen: { weekStart: string; threshold: number } | null,
  away: ReadonlySet<string> = new Set(),
  modifier?: BossModifier,
  ctx: BossContext = {},
): number {
  const current = getBossThreshold(habits, weekStart, modifier, ctx);
  const floor = frozen && frozen.weekStart === weekStart ? Math.max(frozen.threshold, current) : current;

  // A vacation shrinks the target rather than cancelling the week. Blanking
  // the whole week meant two days away silenced the boss for the other five,
  // with the card still claiming you were on holiday. Scaling happens after
  // the frozen floor so a trip can lower a bar that archiving cannot.
  const present = getPresentFraction(habits, weekStart, away, modifier, ctx);
  if (present <= 0) return 0;
  return Math.round(floor * present);
}

export function getBossGoldReward(threshold: number): number {
  return Math.round(threshold * 0.5);
}

/**
 * Progress toward this week's boss, scored in quest face value.
 *
 * It deliberately does NOT use `xpAwarded`: that figure carries every
 * multiplier the character has earned — the XP perk, Momentum, Berserker, an
 * Elixir — while the threshold is a fraction of the quests' base rewards.
 * Scoring inflated XP against a base-rate target made the boss easier the
 * stronger you got, until a late-game character cleared a "60% of your week"
 * bar doing barely a third of it.
 *
 * Entries written before `baseXp` existed fall back to `xpAwarded`, which is
 * the old, slightly generous behaviour, and only for weeks already past.
 */
export function getWeeklyXpEarned(
  completions: CompletionEntry[],
  weekStart: string,
  habitsById?: ReadonlyMap<string, Habit>,
  modifier?: BossModifier,
  ctx: BossContext = {},
): number {
  const weekEnd = getWeekEnd(weekStart);
  return completions
    .filter((c) => c.date >= weekStart && c.date <= weekEnd)
    .reduce((sum, c) => {
      const base = c.baseXp ?? c.xpAwarded;
      const habit = habitsById?.get(c.habitId);
      // No modifier, or a completion whose quest has since been deleted:
      // count it plainly rather than guessing at a weight.
      if (!modifier || !habit) return sum + base;
      return sum + base * modifier.weight(habit, c.date, ctx);
    }, 0);
}

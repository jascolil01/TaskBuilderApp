import type { AttributeKey, Goal } from '../types';
import { addDays, daysBetween, todayStr } from './date';
import { getEffortXp } from './effort';

/**
 * Long-term goals: the thing a habit can't express.
 *
 * A quest asks "did you do it today?" and a streak measures how often you said
 * yes. Neither can hold "read twelve books this year" — an intention with a
 * finish line, where the point is arriving rather than showing up.
 *
 * Two rules keep goals from distorting the systems around them:
 *
 * - **Goals never decay.** Missing a month is not the same kind of failure as
 *   missing a Tuesday, and draining an attribute for it would punish the
 *   ambition rather than the neglect. A goal that expires simply expires.
 *
 * - **Goals never feed the weekly boss.** The boss target is a share of what
 *   your quests could pay that week; a 300 XP goal landing on a Tuesday would
 *   clear it single-handed. Goal XP is recorded outside the boss's units
 *   entirely, the same way the streak bonus is.
 */

export type GoalStatus = 'active' | 'complete' | 'expired';

export interface GoalPace {
  status: GoalStatus;
  /** 0-100, clamped. */
  pct: number;
  daysLeft: number;
  /** Units per remaining day needed to finish on time; null once done or out of time. */
  perDayNeeded: number | null;
  /**
   * True when progress is at or ahead of a straight line from start to
   * deadline. Deliberately a straight line rather than anything cleverer —
   * a goal you're told you're "behind" on in week one is a goal you abandon.
   */
  onPace: boolean;
}

/** Payout scales with the size of the commitment, not the size of the number. */
export const GOAL_XP: Record<Goal['scale'], number> = {
  modest: 120,
  serious: 300,
  major: 600,
};

export const GOAL_GOLD: Record<Goal['scale'], number> = {
  modest: 80,
  serious: 180,
  major: 360,
};

export const GOAL_SCALE_LABEL: Record<Goal['scale'], string> = {
  modest: 'Modest',
  serious: 'Serious',
  major: 'Major',
};

/**
 * A goal's payout compared to the daily quests it sits beside, so the numbers
 * above can be sanity-checked rather than taken on faith. A 'real' quest pays
 * 20 XP, so a Serious goal is worth about fifteen of them — a month of one
 * daily habit. That is meant to feel like a lot, because finishing one is.
 */
export function goalXpInQuests(scale: Goal['scale']): number {
  return Math.round(GOAL_XP[scale] / getEffortXp('real'));
}

export function getGoalStatus(goal: Goal, today = todayStr()): GoalStatus {
  if (goal.completedOn) return 'complete';
  if (goal.progress >= goal.target) return 'complete';
  return today > goal.deadline ? 'expired' : 'active';
}

export function getGoalPace(goal: Goal, today = todayStr()): GoalPace {
  const status = getGoalStatus(goal, today);
  const pct = goal.target > 0 ? Math.min(100, Math.round((goal.progress / goal.target) * 100)) : 0;
  const daysLeft = Math.max(0, daysBetween(today, goal.deadline));
  const remaining = Math.max(0, goal.target - goal.progress);

  if (status !== 'active') {
    return { status, pct, daysLeft, perDayNeeded: null, onPace: status === 'complete' };
  }

  // The whole span, not the span remaining: pace is measured against the plan
  // you made, so a goal set with a generous deadline stays generous.
  const totalDays = Math.max(1, daysBetween(goal.startedOn, goal.deadline));
  const elapsed = Math.max(0, Math.min(totalDays, daysBetween(goal.startedOn, today)));
  const expected = (elapsed / totalDays) * goal.target;

  return {
    status,
    pct,
    daysLeft,
    perDayNeeded: daysLeft > 0 ? remaining / daysLeft : remaining,
    onPace: goal.progress >= Math.floor(expected),
  };
}

export function paceLabel(pace: GoalPace): string {
  if (pace.status === 'complete') return 'Done';
  if (pace.status === 'expired') return 'Time ran out';
  if (pace.daysLeft === 0) return 'Last day';
  if (pace.onPace) return 'On pace';
  const need = pace.perDayNeeded ?? 0;
  if (need <= 1) return 'Behind — one a day clears it';
  return `Behind — ${need.toFixed(1)} a day from here`;
}

/** Clamped so a goal can never be pushed past its own target or below zero. */
export function clampProgress(goal: Goal, next: number): number {
  return Math.max(0, Math.min(goal.target, Math.floor(next)));
}

export interface GoalTemplate {
  id: string;
  name: string;
  attribute: AttributeKey;
  target: number;
  unit: string;
  scale: Goal['scale'];
  /** How many days the preset suggests, from the day you start it. */
  days: number;
  note: string;
}

const YEAR = 365;
const QUARTER = 90;
const MONTH = 30;

function g(
  id: string,
  name: string,
  attribute: AttributeKey,
  target: number,
  unit: string,
  scale: Goal['scale'],
  days: number,
  note: string,
): GoalTemplate {
  return { id, name, attribute, target, unit, scale, days, note };
}

/**
 * Ready-made goals, for the same reason the quest catalog exists: a blank form
 * assumes you already know what you're aiming at. Every one is countable —
 * "read 12 books", not "read more" — because a goal you can't tick is a goal
 * you can't finish.
 */
export const GOAL_TEMPLATES: GoalTemplate[] = [
  // Strength
  g('goal-str-5k', 'Run a 5k without stopping', 'STR', 12, 'runs', 'serious', QUARTER,
    'Twelve runs is roughly a couch-to-5k. The goal is the distance; the runs are how you get there.'),
  g('goal-str-gym-100', '100 gym sessions', 'STR', 100, 'sessions', 'major', YEAR,
    'Twice a week for a year. The number is big; the week is not.'),
  g('goal-str-pullup', 'Ten unbroken pull-ups', 'STR', 30, 'sessions', 'serious', QUARTER,
    'Thirty focused sessions gets most people there from almost nothing.'),
  g('goal-str-walk-month', 'Walk every day for a month', 'STR', 30, 'days', 'modest', MONTH,
    'The easiest one here, and the one most likely to still be going in a year.'),

  // Dexterity
  g('goal-dex-song', 'Learn a piece end to end', 'DEX', 40, 'practices', 'serious', QUARTER,
    'Forty sittings with one piece beats four hundred with forty.'),
  g('goal-dex-sketchbook', 'Fill a sketchbook', 'DEX', 60, 'pages', 'serious', QUARTER,
    'Pages, not masterpieces. The bad ones count.'),
  g('goal-dex-recipes', 'Cook 25 new recipes', 'DEX', 25, 'recipes', 'modest', QUARTER,
    'Two a week. You have to eat anyway.'),
  g('goal-dex-craft', 'Finish the project you started', 'DEX', 20, 'sessions', 'modest', MONTH,
    'Whatever is sitting half-done. Twenty sessions and it is out of your head.'),

  // Constitution
  g('goal-con-sleep', 'Sleep by midnight for 60 nights', 'CON', 60, 'nights', 'serious', QUARTER,
    'Not perfect, just sixty. The cumulative effect is the point.'),
  g('goal-con-dry', 'A dry month', 'CON', 30, 'days', 'modest', MONTH,
    'Thirty days, tracked. Most people find the second half easier.'),
  g('goal-con-cook', 'Cook at home 100 times', 'CON', 100, 'meals', 'major', YEAR,
    'Cheaper, better, and it compounds into a skill.'),
  g('goal-con-water', 'Hit your water target for 90 days', 'CON', 90, 'days', 'serious', QUARTER,
    'The least glamorous entry on this list and one of the most effective.'),

  // Intelligence
  g('goal-int-books', 'Read 12 books', 'INT', 12, 'books', 'major', YEAR,
    'One a month. Roughly fifteen pages a day.'),
  g('goal-int-course', 'Finish the course', 'INT', 30, 'lessons', 'serious', QUARTER,
    'The one you bought and did four lessons of. This is that one.'),
  g('goal-int-language', '100 days of a language', 'INT', 100, 'days', 'major', YEAR,
    'A hundred real days beats a thousand-day streak of ten-second sessions.'),
  g('goal-int-write', 'Write 20,000 words', 'INT', 20, 'thousand words', 'serious', QUARTER,
    'A short book, or a very long start on a long one.'),

  // Wisdom
  g('goal-wis-meditate', 'Meditate 60 times', 'WIS', 60, 'sessions', 'serious', QUARTER,
    'Sixty sittings is where most people stop having to force it.'),
  g('goal-wis-journal', 'Journal for 90 days', 'WIS', 90, 'entries', 'serious', QUARTER,
    'Three months of entries is a record of a version of you that will be gone.'),
  g('goal-wis-review', '52 weekly reviews', 'WIS', 52, 'reviews', 'major', YEAR,
    'One a week for a year. The only habit here that improves all the others.'),
  g('goal-wis-digital', 'Twelve screen-free days', 'WIS', 12, 'days', 'modest', QUARTER,
    'One a week for a season. Harder than it sounds and worth more than it looks.'),

  // Charisma
  g('goal-cha-reconnect', 'Reconnect with 12 people', 'CHA', 12, 'people', 'serious', QUARTER,
    'One a week. The message you keep not sending.'),
  g('goal-cha-host', 'Host six times', 'CHA', 6, 'gatherings', 'serious', QUARTER,
    'Dinner, drinks, a walk. Hosting is a skill and it decays without use.'),
  g('goal-cha-talks', 'Speak in public five times', 'CHA', 5, 'talks', 'major', YEAR,
    'Meetings count. Toasts count. The fifth is enormously easier than the first.'),
  g('goal-cha-calls', 'Fifty proper conversations', 'CHA', 50, 'calls', 'major', YEAR,
    'Not texts. Calls, or in person, long enough to actually get somewhere.'),
];

const BY_ID = new Map(GOAL_TEMPLATES.map((t) => [t.id, t]));

export function getGoalTemplate(id: string): GoalTemplate | null {
  return BY_ID.get(id) ?? null;
}

export function getGoalTemplatesFor(attribute: AttributeKey): GoalTemplate[] {
  return GOAL_TEMPLATES.filter((t) => t.attribute === attribute);
}

/** The deadline a preset suggests, measured from the day you take it on. */
export function suggestedDeadline(template: GoalTemplate, from = todayStr()): string {
  return addDays(from, template.days);
}

export function auditGoalCatalog(): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  for (const t of GOAL_TEMPLATES) {
    if (ids.has(t.id)) problems.push(`duplicate id: ${t.id}`);
    ids.add(t.id);
    if (t.target < 1) problems.push(`${t.id}: target below 1`);
    if (t.days < 1) problems.push(`${t.id}: no time allowed`);
    // A goal you cannot finish even at one a day is a goal that only ever
    // expires, which is worse than not offering it.
    if (t.target > t.days) problems.push(`${t.id}: ${t.target} in ${t.days} days is impossible`);
    if (!t.unit.trim()) problems.push(`${t.id}: no unit`);
  }
  return problems;
}

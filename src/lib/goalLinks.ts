import type { CompletionEntry, Goal } from '../types';
import { todayStr } from './date';
import { getGoalStatus } from './goals';

/**
 * Quests that feed a goal.
 *
 * A goal and the quest that gets you there were two unconnected things: you
 * went to the gym, ticked the quest, and then had to remember to also tick
 * "100 gym sessions" by hand. Two records of the same event, one of which you
 * were always going to forget, which is exactly how a goal quietly stops
 * being true.
 *
 * So a goal can be fed by quests. Complete the quest and the goal counts up;
 * undo it and the goal counts back down. A goal can be fed by several quests
 * at once ("Weights" and "Swim" both being a session), and every completion
 * counts, so two linked quests done on the same day count two.
 *
 * The count is **derived, never incremented.** A goal's progress is read back
 * out of the completion log every time it's needed rather than being nudged
 * up and down by hand, which is the only way it cannot drift: there is no
 * sequence of completing, undoing, backfilling, importing a save or closing
 * the app mid-write that can leave the number disagreeing with the history it
 * claims to summarise.
 *
 * Progress therefore has two parts: what quests have earned, and what you
 * typed in yourself. They add up, and the goal shows both.
 */

export interface GoalLink {
  habitId: string;
  /**
   * Completions from this date onward count.
   *
   * Without it, linking a quest to a goal you had already ticked up by hand
   * would count the same sessions twice — once in the number you typed and
   * again out of the log. Linking starts from today and leaves the past
   * alone, so the figure never jumps when you connect the two.
   */
  since: string;
}

/** What you have entered by hand. Goals that predate linking have only this. */
export function manualProgress(goal: Goal): number {
  return Math.max(0, Math.floor(goal.manualProgress ?? goal.progress));
}

export function getLinks(goal: Goal): GoalLink[] {
  return goal.links ?? [];
}

export function isLinked(goal: Goal, habitId: string): boolean {
  return getLinks(goal).some((l) => l.habitId === habitId);
}

/**
 * How much one linked quest has contributed.
 *
 * Bounded by the goal's own window as well as the link's: completions logged
 * after the deadline don't count toward a goal whose time is up, because the
 * deadline is the commitment.
 */
export function countFor(goal: Goal, habitId: string, completions: CompletionEntry[]): number {
  const link = getLinks(goal).find((l) => l.habitId === habitId);
  if (!link) return 0;
  let n = 0;
  for (const c of completions) {
    if (c.habitId !== habitId) continue;
    if (c.date < link.since || c.date > goal.deadline) continue;
    n += 1;
  }
  return n;
}

/** What every linked quest has contributed, together. */
export function linkedProgress(goal: Goal, completions: CompletionEntry[]): number {
  let n = 0;
  for (const link of getLinks(goal)) n += countFor(goal, link.habitId, completions);
  return n;
}

/**
 * The goal's true progress: what you logged plus what your quests earned,
 * never past the target.
 */
export function goalProgress(goal: Goal, completions: CompletionEntry[]): number {
  return Math.min(goal.target, manualProgress(goal) + linkedProgress(goal, completions));
}

/** The goals a given quest feeds, for showing on the quest itself. */
export function goalsFedBy(goals: Goal[], habitId: string): Goal[] {
  return goals.filter((g) => isLinked(g, habitId) && !g.completedOn);
}

/**
 * How much manual progress can still be entered before the target is reached.
 * Quests eat into the same total, so the by-hand control has to know.
 */
export function manualHeadroom(goal: Goal, completions: CompletionEntry[]): number {
  return Math.max(0, goal.target - linkedProgress(goal, completions));
}

export interface Settled {
  goals: Goal[];
  /** Reached its target on this pass, in time: owed a payout. */
  finished: Goal[];
  /** Reached its target on this pass, too late to pay. */
  finishedLate: Goal[];
  /** True when anything at all changed, so a no-op write can be skipped. */
  changed: boolean;
}

/**
 * Recomputes every goal from the completion log and marks any that have just
 * arrived.
 *
 * This runs after anything that can move a linked quest — completing, undoing,
 * backfilling, linking, deleting — rather than each of those trying to work
 * out the consequences for itself. One place decides what a goal's number is,
 * so there is no second implementation to disagree with it.
 *
 * `completedOn` is set here and never cleared, which is what keeps a goal from
 * paying twice: undoing a completion drops the progress back below the target
 * but the achievement stands, exactly as it does when you tick a goal down by
 * hand.
 */
export function settleGoals(
  goals: Goal[],
  completions: CompletionEntry[],
  today = todayStr(),
): Settled {
  const finished: Goal[] = [];
  const finishedLate: Goal[] = [];
  let changed = false;

  const next = goals.map((goal) => {
    const progress = goalProgress(goal, completions);
    const arriving = progress >= goal.target && !goal.completedOn;
    if (progress === goal.progress && !arriving) return goal;

    changed = true;
    const updated: Goal = {
      ...goal,
      progress,
      manualProgress: manualProgress(goal),
      ...(arriving ? { completedOn: today } : {}),
    };
    if (arriving) {
      // Expired is judged on the goal as it was: a deadline that has passed
      // has passed, and landing the last session after it still counts as
      // done without paying out.
      if (getGoalStatus(goal, today) === 'expired') finishedLate.push(updated);
      else finished.push(updated);
    }
    return updated;
  });

  return { goals: next, finished, finishedLate, changed };
}

/**
 * Removes a quest's link, keeping what it earned.
 *
 * Deleting a quest deletes its completions, so a goal deriving 60 of 100 from
 * it would silently collapse to nothing. Folding the count into the manual
 * figure first means you keep the sixty sessions you actually did — deleting
 * the quest you used to track them is not the same as not having done them.
 */
export function foldLinkIntoManual(
  goal: Goal,
  habitId: string,
  completions: CompletionEntry[],
): Goal {
  if (!isLinked(goal, habitId)) return goal;
  const earned = countFor(goal, habitId, completions);
  return {
    ...goal,
    links: getLinks(goal).filter((l) => l.habitId !== habitId),
    manualProgress: Math.min(goal.target, manualProgress(goal) + earned),
  };
}

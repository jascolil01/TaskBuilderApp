import type { AttributeKey, Frequency } from '../types';
import { isValidPairing } from './affinity';
import type { EffortTier } from './effort';

/**
 * A library of ready-made quests.
 *
 * The blank "New Quest" form assumes you already know what habit you want,
 * which is the one thing someone starting out usually doesn't. Everything here
 * is pre-set — attribute, effort, schedule, grace — so adding one is a single
 * tap, and browsing doubles as an explanation of what each attribute covers.
 *
 * Deliberately concrete ("Read 10 pages", not "read more"): a quest you can
 * finish is one you can tick off, and a vague one never gets ticked.
 */

const DAILY: Frequency = { type: 'daily' };
const WEEKDAYS: Frequency = { type: 'weekly', days: [1, 2, 3, 4, 5] };
const days = (...d: number[]): Frequency => ({ type: 'weekly', days: d });

export interface QuestTemplate {
  id: string;
  name: string;
  attribute: AttributeKey;
  effort: EffortTier;
  frequency: Frequency;
  graceDays: number;
  /**
   * The attribute this quest also builds, a little. Hand-picked per quest and
   * checked against lib/affinity by the audit, so the catalog can't ship a
   * pairing the picker would refuse. Absent where a quest honestly does one
   * thing and one thing only.
   */
  secondary?: AttributeKey;
  /** One line on why it's worth doing. */
  note: string;
}

function q(
  id: string,
  name: string,
  attribute: AttributeKey,
  effort: EffortTier,
  frequency: Frequency,
  graceDays: number,
  note: string,
  secondary?: AttributeKey,
): QuestTemplate {
  return { id, name, attribute, effort, frequency, graceDays, note, secondary };
}

export const QUEST_TEMPLATES: QuestTemplate[] = [
  // Strength — physical training, exercise, exertion
  q('str-stairs', 'Take the stairs', 'STR', 'quick', DAILY, 2, 'The smallest possible start. Almost impossible to fail.', 'CON'),
  q('str-pushups', '10 push-ups', 'STR', 'quick', DAILY, 2, 'Two minutes, no equipment, anywhere.'),
  q('str-stretch', 'Stretch for 10 minutes', 'STR', 'short', DAILY, 2, 'Best paired with something you already do daily.', 'DEX'),
  q('str-walk', 'Walk for 20 minutes', 'STR', 'short', DAILY, 1, 'The most underrated exercise there is.', 'CON'),
  q('str-cardio', '30 minutes of cardio', 'STR', 'real', days(2, 4, 6), 1, 'Three times a week is plenty to start.', 'CON'),
  q('str-active-commute', 'Walk or cycle instead of driving', 'STR', 'real', WEEKDAYS, 2, 'Turns a trip you already make into training.', 'CON'),
  q('str-gym', 'Go to the gym', 'STR', 'hard', days(1, 3, 5), 1, 'Schedule it like an appointment, not a mood.', 'CON'),
  q('str-long-session', 'Long training session', 'STR', 'major', days(6), 2, 'One serious effort a week, when you have the time.', 'CON'),

  // Dexterity — skill practice, coordination, agility
  q('dex-instrument', 'Practise an instrument', 'DEX', 'real', DAILY, 1, 'Twenty minutes daily beats three hours on Sunday.', 'WIS'),
  q('dex-sketch', 'Sketch something', 'DEX', 'short', DAILY, 2, 'It does not have to be good. It has to exist.', 'WIS'),
  q('dex-typing', '10 minutes of typing practice', 'DEX', 'short', WEEKDAYS, 2, 'A skill you use every day and rarely train.'),
  q('dex-drill', 'One focused skill drill', 'DEX', 'quick', DAILY, 2, 'Pick the one sticking point and drill only that.', 'WIS'),
  q('dex-mobility', 'Yoga or mobility work', 'DEX', 'real', days(1, 3, 5), 1, 'Balance and control, not strength.', 'STR'),
  q('dex-cook-new', 'Cook something you have never made', 'DEX', 'real', days(3, 0), 2, 'A skill that feeds you is a skill worth having.'),
  q('dex-craft', 'Work on a craft project', 'DEX', 'hard', days(6, 0), 2, 'Weekend hours, on something with your hands.', 'WIS'),
  q('dex-deliberate', 'Deliberate practice, no autopilot', 'DEX', 'hard', WEEKDAYS, 1, 'Hard, focused repetition on the thing you are worst at.', 'WIS'),

  // Constitution — health, sleep, nutrition, endurance
  q('con-water', 'Glass of water on waking', 'CON', 'quick', DAILY, 2, 'The easiest habit on this list. Start here.'),
  q('con-vitamins', 'Take vitamins', 'CON', 'quick', DAILY, 3, 'Trivial to do, easy to forget — perfect for a streak.'),
  q('con-lights-out', 'Lights out by midnight', 'CON', 'short', DAILY, 1, 'Sleep is the one that makes every other habit easier.', 'WIS'),
  q('con-breakfast', 'Eat a real breakfast', 'CON', 'short', DAILY, 2, 'Not a coffee. An actual meal.'),
  q('con-prep-lunch', 'Pack tomorrow’s lunch', 'CON', 'short', WEEKDAYS, 1, 'Ten minutes tonight saves a bad decision tomorrow.', 'WIS'),
  q('con-no-screens', 'No screens an hour before bed', 'CON', 'real', DAILY, 1, 'The hardest easy habit. Worth it.', 'WIS'),
  q('con-cook', 'Cook instead of ordering', 'CON', 'real', DAILY, 2, 'Cheaper, better, and you know what is in it.', 'WIS'),
  q('con-dry', 'No alcohol today', 'CON', 'real', DAILY, 0, 'No grace period — the whole point is the unbroken run.', 'WIS'),

  // Intelligence — study, reading, learning, focus work
  q('int-read', 'Read 10 pages', 'INT', 'short', DAILY, 2, 'Ten pages a day is roughly fifteen books a year.', 'WIS'),
  q('int-flashcards', 'Review flashcards', 'INT', 'quick', DAILY, 1, 'Spaced repetition only works if it is daily.'),
  q('int-language', 'Practise a language', 'INT', 'short', DAILY, 1, 'Little and often is the only thing that works here.', 'CHA'),
  q('int-study', 'Study for 30 minutes', 'INT', 'real', DAILY, 2, 'One focused half hour, phone in another room.', 'WIS'),
  q('int-write', 'Write a page', 'INT', 'real', DAILY, 2, 'Whatever it is — a journal, a draft, notes. A page.', 'CHA'),
  q('int-long-read', 'Read a paper or long article', 'INT', 'real', days(0), 2, 'One properly difficult thing a week.', 'WIS'),
  q('int-deep-work', 'Deep work block, no phone', 'INT', 'hard', WEEKDAYS, 1, 'An uninterrupted hour is worth a scattered four.', 'WIS'),
  q('int-side-project', 'Work on the side project', 'INT', 'hard', days(2, 4, 6), 2, 'The one you keep meaning to get back to.'),

  // Wisdom — mindfulness, reflection, discipline
  q('wis-bed', 'Make the bed', 'WIS', 'quick', DAILY, 2, 'A finished task before the day has started.', 'CON'),
  q('wis-plan', 'Plan tomorrow before you stop', 'WIS', 'quick', WEEKDAYS, 1, 'Five minutes tonight buys a calmer morning.', 'INT'),
  q('wis-quiet', 'Ten minutes of quiet', 'WIS', 'short', DAILY, 2, 'No phone, no music, no input. Just ten minutes.'),
  q('wis-journal', 'Journal before bed', 'WIS', 'short', DAILY, 2, 'Three lines counts.', 'INT'),
  q('wis-meditate', 'Meditate', 'WIS', 'real', DAILY, 1, 'Consistency matters far more than duration.', 'CON'),
  q('wis-walk-quiet', 'Walk without headphones', 'WIS', 'real', DAILY, 2, 'Boredom is where the good thinking happens.', 'CON'),
  q('wis-review', 'Weekly review of how it went', 'WIS', 'real', days(0), 1, 'Twenty honest minutes on what worked and what did not.', 'INT'),
  q('wis-screen-free', 'A day away from screens', 'WIS', 'hard', days(0), 1, 'Hard the first few times, then oddly easy.', 'CON'),

  // Charisma — social habits, connection, creativity
  q('cha-message', 'Message someone you have not spoken to', 'CHA', 'quick', DAILY, 2, 'Thirty seconds. Nobody has ever regretted it.'),
  q('cha-kind', 'Say something kind out loud', 'CHA', 'quick', DAILY, 2, 'Out loud, to a person, not in your head.', 'WIS'),
  q('cha-call', 'Call a friend or family member', 'CHA', 'short', days(2, 0), 2, 'A call beats a text. Twice a week is enough.', 'WIS'),
  q('cha-plans', 'Make plans with someone', 'CHA', 'short', days(5), 2, 'Actually put it in the calendar.'),
  q('cha-share', 'Share something you made', 'CHA', 'real', days(0), 2, 'Publishing badly beats polishing forever.'),
  q('cha-practise-talk', 'Practise speaking or presenting', 'CHA', 'real', days(1, 3), 2, 'Out loud, on your feet, even alone.', 'INT'),
  q('cha-go-out', 'Go somewhere with people in it', 'CHA', 'real', days(6), 2, 'A cafe counts. Leaving the house is the habit.'),
  q('cha-cook-for', 'Cook for someone else', 'CHA', 'hard', days(0), 2, 'An afternoon that feeds a friendship.', 'WIS'),
];

const BY_ID = new Map(QUEST_TEMPLATES.map((t) => [t.id, t]));

export function getTemplate(id: string): QuestTemplate | null {
  return BY_ID.get(id) ?? null;
}

export function getTemplatesFor(attribute: AttributeKey): QuestTemplate[] {
  return QUEST_TEMPLATES.filter((t) => t.attribute === attribute);
}

/**
 * A short, deliberately easy starting set for a brand-new character — one
 * quick win per attribute rather than the whole library, because "pick from
 * 48" is its own kind of overwhelming.
 */
export const STARTER_PICKS = [
  'con-water',
  'wis-bed',
  'str-walk',
  'int-read',
  'cha-message',
  'dex-sketch',
  'con-lights-out',
  'str-pushups',
];

export function getStarterTemplates(): QuestTemplate[] {
  return STARTER_PICKS.map((id) => BY_ID.get(id)).filter((t): t is QuestTemplate => Boolean(t));
}

/** Sanity net so a bad edit can't ship a duplicate id or an empty attribute. */
export function auditCatalog(): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  for (const t of QUEST_TEMPLATES) {
    if (ids.has(t.id)) problems.push(`duplicate id: ${t.id}`);
    ids.add(t.id);
    if (t.frequency.type === 'weekly' && t.frequency.days.length === 0) {
      problems.push(`${t.id} is scheduled for no days`);
    }
    // A catalog secondary has to satisfy the same table the picker enforces,
    // or a preset could hand out a pairing you couldn't have chosen yourself.
    if (t.secondary && !isValidPairing(t.attribute, t.secondary)) {
      problems.push(`${t.id}: ${t.attribute} cannot support ${t.secondary}`);
    }
  }
  for (const id of STARTER_PICKS) {
    if (!ids.has(id)) problems.push(`starter pick ${id} is not in the catalog`);
  }
  return problems;
}

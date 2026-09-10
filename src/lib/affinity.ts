import type { AttributeKey } from '../types';

/**
 * Which attributes a quest can support on the side.
 *
 * A quest gives most of its XP to one attribute, but real habits rarely serve
 * only one thing: lifting builds endurance as well as strength, and studying
 * sharpens judgement as well as knowledge. A secondary attribute lets a quest
 * say so.
 *
 * The pairings are a fixed table rather than a free choice, because a free
 * choice is only ever used one way. Nothing about "working out" grants
 * Intelligence, but if the picker offered it, an optimiser would take it — and
 * then the attributes stop describing anything. Offering only what's plausible
 * means the honest answer is the only answer available, which is the same
 * reasoning behind the effort tiers replacing the free XP field.
 *
 * The table is deliberately not symmetric. Charisma quests can build Wisdom —
 * time with people teaches you to read them — but a Wisdom quest doesn't
 * usually make you more sociable, so Wisdom does not offer Charisma back.
 */
export const AFFINITIES: Record<AttributeKey, AttributeKey[]> = {
  // Exertion builds endurance; athletic movement needs coordination.
  STR: ['CON', 'DEX'],
  // Skill practice needs physical control, and precision needs focus.
  DEX: ['STR', 'WIS'],
  // Health habits raise physical capacity; sleep and food are disciplines.
  CON: ['STR', 'WIS'],
  // Study sharpens judgement, and explaining what you learned is a social act.
  INT: ['WIS', 'CHA'],
  // Reflection sharpens thinking; discipline builds resilience.
  WIS: ['INT', 'CON'],
  // Time with people teaches you to read them, and to learn from them.
  CHA: ['WIS', 'INT'],
};

/**
 * The secondary earns this share of what the primary was paid, floored.
 *
 * Applied to the *awarded* XP rather than the quest's face value, so a perk or
 * a long streak lifts both together — a quest that has become worth more to you
 * is worth more on both counts. Deep Work's spillover works the same way.
 */
export const SECONDARY_SHARE = 0.3;

export function getAffinities(primary: AttributeKey): AttributeKey[] {
  return AFFINITIES[primary];
}

/** Whether a pairing is one the table allows. Never trust a stored value. */
export function isValidPairing(primary: AttributeKey, secondary: AttributeKey | null | undefined): boolean {
  if (!secondary) return false;
  return AFFINITIES[primary].includes(secondary);
}

/**
 * Drops a secondary that no longer makes sense. Editing a quest's primary
 * attribute can strand its secondary — moving a Strength quest to Intelligence
 * leaves Constitution attached to something it has nothing to do with — so
 * every read goes through here rather than trusting what was saved.
 */
export function resolveSecondary(
  primary: AttributeKey,
  secondary: AttributeKey | null | undefined,
): AttributeKey | null {
  return isValidPairing(primary, secondary) ? secondary! : null;
}

export function getSecondaryXp(awardedXp: number, hasSecondary: boolean): number {
  if (!hasSecondary) return 0;
  return Math.floor(Math.max(0, awardedXp) * SECONDARY_SHARE);
}

/** Sanity net so a bad edit can't ship a pairing that points at itself. */
export function auditAffinities(): string[] {
  const problems: string[] = [];
  for (const [primary, list] of Object.entries(AFFINITIES) as [AttributeKey, AttributeKey[]][]) {
    if (list.includes(primary)) problems.push(`${primary} lists itself`);
    if (new Set(list).size !== list.length) problems.push(`${primary} has a duplicate`);
    if (list.length === 0) problems.push(`${primary} offers nothing`);
  }
  return problems;
}

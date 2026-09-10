import type { AttributeKey, Attributes } from '../types';
import { ATTRIBUTE_KEYS } from './rpg';

/**
 * The twelve classes of the 2024 Player's Handbook.
 *
 * This replaces the six one-per-attribute classes the app started with, where
 * "your highest stat is your class" was the whole rule. Real 5e classes don't
 * work that way: a Monk needs Dexterity *and* Wisdom, a Paladin needs Strength
 * *and* Charisma, and three separate classes all lead on Charisma.
 *
 * So each class is described by its actual source data — primary ability,
 * saving throws, hit die — and the weights used to match a player to a class
 * are *derived* from that, never hand-tuned. Keeping the table faithful to the
 * book and computing from it means the fantasy and the mechanics can't drift
 * apart, and correcting a class is a one-line data edit.
 *
 * One consequence worth knowing: 5e has no Constitution-primary class. The old
 * Guardian has no equivalent, so a Constitution-led player becomes a Barbarian
 * — which falls out of the weights on its own, since the d12 hit die and the
 * Constitution saving throw give Barbarian more Constitution weight than any
 * other class.
 */

export type ClassId =
  | 'barbarian'
  | 'bard'
  | 'cleric'
  | 'druid'
  | 'fighter'
  | 'monk'
  | 'paladin'
  | 'ranger'
  | 'rogue'
  | 'sorcerer'
  | 'warlock'
  | 'wizard';

export type HitDie = 6 | 8 | 10 | 12;

export interface ClassDef {
  id: ClassId;
  name: string;
  /**
   * Primary ability. Two entries means the class needs both (Monk, Paladin);
   * `eitherPrimary` marks the one class — Fighter — whose book entry reads
   * "Strength *or* Dexterity", where only the better of the two counts.
   */
  primary: AttributeKey[];
  eitherPrimary?: boolean;
  saves: [AttributeKey, AttributeKey];
  hitDie: HitDie;
  tagline: string;
  description: string;
}

export const CLASSES: readonly ClassDef[] = [
  {
    id: 'barbarian',
    name: 'Barbarian',
    primary: ['STR'],
    saves: ['STR', 'CON'],
    hitDie: 12,
    tagline: 'A Fierce Warrior of Primal Rage',
    description: 'Barbarians are mighty warriors who are powered by primal forces of the multiverse that manifest as Rage.',
  },
  {
    id: 'bard',
    name: 'Bard',
    primary: ['CHA'],
    saves: ['DEX', 'CHA'],
    hitDie: 8,
    tagline: 'An Inspiring Performer of Music, Dance, and Magic',
    description: 'Bards are expert at inspiring others, soothing hurts, disheartening foes, and creating illusions.',
  },
  {
    id: 'cleric',
    name: 'Cleric',
    primary: ['WIS'],
    saves: ['WIS', 'CHA'],
    hitDie: 8,
    tagline: 'A Miraculous Agent of Divine Power',
    description: 'Clerics draw on the divine magic of the Outer Planes to devote themselves to healing and inspiring others.',
  },
  {
    id: 'druid',
    name: 'Druid',
    primary: ['WIS'],
    saves: ['INT', 'WIS'],
    hitDie: 8,
    tagline: 'A Nature Priest of Primal Power',
    description: 'Druids call on the forces of nature, harnessing magic to heal, transform into animals, and wield elemental destruction.',
  },
  {
    id: 'fighter',
    name: 'Fighter',
    primary: ['STR', 'DEX'],
    eitherPrimary: true,
    saves: ['STR', 'CON'],
    hitDie: 10,
    tagline: 'A Master of All Arms and Armor',
    description: 'Fighters share an unparalleled prowess with weapons and armor, and are well acquainted with death, both meting it out and defying it.',
  },
  {
    id: 'monk',
    name: 'Monk',
    primary: ['DEX', 'WIS'],
    saves: ['STR', 'DEX'],
    hitDie: 8,
    tagline: 'A Master of Supernatural Focus',
    description: 'Monks focus their internal reservoirs of power to create extraordinary, even supernatural, effects.',
  },
  {
    id: 'paladin',
    name: 'Paladin',
    primary: ['STR', 'CHA'],
    saves: ['WIS', 'CHA'],
    hitDie: 10,
    tagline: 'A Devout Warrior of Sacred Oaths',
    description: 'Paladins live on the front lines of the cosmic struggle, united by their oaths against the forces of annihilation.',
  },
  {
    id: 'ranger',
    name: 'Ranger',
    primary: ['DEX', 'WIS'],
    saves: ['STR', 'DEX'],
    hitDie: 10,
    tagline: 'A Wandering Warrior Imbued with Primal Magic',
    description: 'Rangers are honed with deadly focus and harness primal powers to protect the world from the ravages of monsters and tyrants.',
  },
  {
    id: 'rogue',
    name: 'Rogue',
    primary: ['DEX'],
    saves: ['DEX', 'INT'],
    hitDie: 8,
    tagline: 'A Dexterous Expert in Stealth and Subterfuge',
    description: 'Rogues have a knack for finding the solution to just about any problem, prioritizing subtle strokes over brute strength.',
  },
  {
    id: 'sorcerer',
    name: 'Sorcerer',
    primary: ['CHA'],
    saves: ['CON', 'CHA'],
    hitDie: 6,
    tagline: 'A Dazzling Mage Filled with Innate Magic',
    description: 'Sorcerers harness and channel the raw, roiling power of innate magic that is order in their very being.',
  },
  {
    id: 'warlock',
    name: 'Warlock',
    primary: ['CHA'],
    saves: ['WIS', 'CHA'],
    hitDie: 8,
    tagline: 'An Occultist Empowered by Otherworldly Pacts',
    description: 'Warlocks quest for knowledge that lies hidden in the fabric of the multiverse, piecing together arcane secrets to bolster their own power.',
  },
  {
    id: 'wizard',
    name: 'Wizard',
    primary: ['INT'],
    saves: ['INT', 'WIS'],
    hitDie: 6,
    tagline: 'A Scholarly Magic-User of Arcane Power',
    description: 'Wizards are capable of explosive, subtle, and long-lasting magic, defined by their exhaustive studies rather than innate talent.',
  },
];

export const CLASS_IDS: readonly ClassId[] = CLASSES.map((c) => c.id);

const BY_ID = new Map(CLASSES.map((c) => [c.id, c]));

export function getClassDef(id: ClassId): ClassDef {
  const def = BY_ID.get(id);
  if (!def) throw new Error(`Unknown class: ${id}`);
  return def;
}

export function isClassId(value: unknown): value is ClassId {
  return typeof value === 'string' && BY_ID.has(value as ClassId);
}

/** Weight of a primary ability, relative to a saving throw. */
const PRIMARY_WEIGHT = 3;
const SAVE_WEIGHT = 1;

/**
 * Hit points are Constitution made visible, so the hit die is read as
 * Constitution weight: d12 → 2, d10 → 1.5, d8 → 1, d6 → 0.5. This is what
 * separates the classes the book otherwise describes identically — Monk and
 * Ranger share a primary pair *and* a save pair, and differ only in how
 * hardy they are.
 */
function hitDieConWeight(die: HitDie): number {
  return (die - 4) / 4;
}

export type Weights = Partial<Record<AttributeKey, number>>;

/**
 * How much each attribute matters to a class.
 *
 * `attributes` is only consulted for Fighter, whose primary is "Strength or
 * Dexterity" — there, the better of the player's two takes the primary weight
 * rather than splitting it, since a Dexterity fighter is not half a fighter.
 */
export function getClassWeights(def: ClassDef, attributes?: Attributes): Weights {
  const w: Weights = {};
  const add = (key: AttributeKey, amount: number) => {
    w[key] = (w[key] ?? 0) + amount;
  };

  if (def.eitherPrimary) {
    const best = attributes
      ? def.primary.reduce((a, b) => (attributes[b].level > attributes[a].level ? b : a))
      : def.primary[0];
    add(best, PRIMARY_WEIGHT);
  } else {
    for (const key of def.primary) add(key, PRIMARY_WEIGHT);
  }

  for (const key of def.saves) add(key, SAVE_WEIGHT);
  add('CON', hitDieConWeight(def.hitDie));

  return w;
}

/**
 * A class's fit, as the weighted average of the attribute levels it cares
 * about. Dividing by total weight is what stops a class that cares about four
 * attributes from beating a focused one purely by counting more of them: a
 * pure-Dexterity player has to come out a Rogue, not a Ranger.
 */
export function getClassFit(def: ClassDef, attributes: Attributes): number {
  const weights = getClassWeights(def, attributes);
  let weighted = 0;
  let total = 0;
  for (const key of ATTRIBUTE_KEYS) {
    const weight = weights[key];
    if (!weight) continue;
    weighted += weight * attributes[key].level;
    total += weight;
  }
  return total > 0 ? weighted / total : 0;
}

/** Every attribute currently tied for the highest level. */
export function getTopAttributes(attributes: Attributes): AttributeKey[] {
  const best = Math.max(...ATTRIBUTE_KEYS.map((k) => attributes[k].level));
  return ATTRIBUTE_KEYS.filter((k) => attributes[k].level === best);
}

/**
 * The classes a player may present as.
 *
 * A class is offered when every primary ability it needs is one of your
 * strongest — so a Dexterity/Wisdom tie offers the two classes built on that
 * exact pair, Monk and Ranger, *and* the classes built on either half of it:
 * Rogue and Fighter for Dexterity, Cleric and Druid for Wisdom. Leading on one
 * attribute alone still leaves a choice, since Charisma alone covers Bard,
 * Sorcerer and Warlock.
 *
 * The best-fit class is always included even when nothing qualifies, which is
 * what keeps a Constitution-led player from having no class at all.
 */
export function getSelectableClasses(attributes: Attributes): ClassId[] {
  const top = new Set(getTopAttributes(attributes));
  const qualifying = CLASSES.filter((def) => {
    // Fighter needs only the half of "Strength or Dexterity" you actually have.
    if (def.eitherPrimary) return def.primary.some((k) => top.has(k));
    return def.primary.every((k) => top.has(k));
  }).map((c) => c.id);

  const best = getBestFitClass(attributes);
  return qualifying.includes(best) ? qualifying : [best, ...qualifying];
}

/**
 * Deterministic tiebreak for equal fits, so a class can't flicker between
 * renders. Ordered by how iconic each class is for the attributes it leads on,
 * which also keeps continuity with the six classes this replaced: a
 * Wisdom-led character stays a Cleric rather than becoming a Druid, and a
 * Strength/Constitution tie resolves to Barbarian over Fighter.
 */
const FIT_TIEBREAK: readonly ClassId[] = [
  'barbarian', 'fighter', 'paladin', 'ranger', 'monk', 'rogue',
  'wizard', 'cleric', 'druid', 'bard', 'warlock', 'sorcerer',
];

export function getBestFitClass(attributes: Attributes): ClassId {
  let best: ClassId = 'fighter';
  let bestFit = -Infinity;
  for (const id of FIT_TIEBREAK) {
    const fit = getClassFit(getClassDef(id), attributes);
    if (fit > bestFit) {
      bestFit = fit;
      best = id;
    }
  }
  return best;
}

export interface ClassStanding {
  /** The class the character presents as. */
  id: ClassId;
  def: ClassDef;
  /** Every class currently on offer, best fit first. */
  selectable: ClassId[];
  /** True when `id` came from the player's choice rather than the best fit. */
  chosen: boolean;
}

/**
 * Resolves the class a character presents as.
 *
 * `preferred` is honoured only while that class is still on offer: a choice
 * made when Dexterity and Wisdom were tied must not keep someone a Monk once
 * their Strength has genuinely overtaken both. When the choice stops
 * qualifying it quietly lapses back to the best fit, rather than pinning them
 * to a class their habits no longer support.
 */
export function getClassStanding(attributes: Attributes, preferred?: ClassId | null): ClassStanding {
  const best = getBestFitClass(attributes);
  const selectable = getSelectableClasses(attributes);
  const ordered = [best, ...selectable.filter((id) => id !== best)];
  const id = preferred && selectable.includes(preferred) ? preferred : best;
  return { id, def: getClassDef(id), selectable: ordered, chosen: id !== best };
}

/**
 * Attributes whose gear and rewards a class inherits — used only by the
 * migration that carries the old six attribute-keyed sets forward. Fighter
 * covers both halves of its "or"; Constitution has no primary class at all, so
 * the two classes carrying the most Constitution weight take it.
 */
export function getClassesForAttribute(attribute: AttributeKey): ClassId[] {
  if (attribute === 'CON') return ['barbarian', 'fighter'];
  return CLASSES.filter((def) => def.primary.includes(attribute)).map((c) => c.id);
}

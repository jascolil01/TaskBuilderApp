import type { AttributeKey } from '../types';
import { ATTRIBUTE_KEYS } from './rpg';

/**
 * Cosmetic gear. Each class has one alternative for every slot plus a
 * legendary aura, and every piece is pure vanity — the shop can never sell
 * an advantage, only a look.
 *
 * Gear is locked to the class that wears it, but owning it is permanent: your
 * class is whatever attribute is currently highest, so it can shift on its
 * own, and gear you paid for must never be stranded by that. Pieces for a
 * class you aren't right now are simply hidden until you are again.
 */

export type CosmeticSlot = 'head' | 'shoulders' | 'weapon' | 'cloak' | 'boots' | 'aura';

export const COSMETIC_SLOTS: CosmeticSlot[] = ['head', 'shoulders', 'weapon', 'cloak', 'boots', 'aura'];

export const SLOT_LABELS: Record<CosmeticSlot, string> = {
  head: 'Head',
  shoulders: 'Shoulders',
  weapon: 'Weapon',
  cloak: 'Cloak',
  boots: 'Boots',
  aura: 'Aura',
};

export const GEAR_COST = 750;
export const LEGENDARY_GEAR_COST = 2500;

export interface GearItem {
  id: string;
  name: string;
  attribute: AttributeKey;
  slot: CosmeticSlot;
  cost: number;
  description: string;
  /** Auras are the one-per-class legendary: spectacle, never a stat. */
  legendary: boolean;
}

function set(
  attribute: AttributeKey,
  entries: Record<CosmeticSlot, { name: string; description: string }>,
): GearItem[] {
  const prefix = attribute.toLowerCase();
  return COSMETIC_SLOTS.map((slot) => ({
    id: `${prefix}-${slot}`,
    name: entries[slot].name,
    attribute,
    slot,
    cost: slot === 'aura' ? LEGENDARY_GEAR_COST : GEAR_COST,
    description: entries[slot].description,
    legendary: slot === 'aura',
  }));
}

export const GEAR_ITEMS: GearItem[] = [
  ...set('STR', {
    head: { name: 'Dragonhorn Helm', description: 'A horned warhelm with a blackened visor.' },
    shoulders: { name: 'Bulwark Pauldrons', description: 'Spiked plate that squares off the shoulders.' },
    weapon: { name: 'Sunforged Greatsword', description: 'A broader, gold-chased blade.' },
    cloak: { name: 'Wolfpelt Mantle', description: 'Heavy fur that drags behind the stride.' },
    boots: { name: 'Ironshod Sabatons', description: 'Banded steel boots.' },
    aura: { name: 'Ember Wake', description: 'Embers lift from every footfall and burn out behind you.' },
  }),
  ...set('DEX', {
    head: { name: 'Shadowed Cowl', description: 'A deep hood that leaves only the eyes.' },
    shoulders: { name: 'Twin Quivers', description: 'Paired quivers crossed at the back.' },
    weapon: { name: "Hunter's Recurve", description: 'A longer bow with swept limbs.' },
    cloak: { name: 'Leafweave Cloak', description: 'A layered cloak cut like foliage.' },
    boots: { name: 'Silent Treads', description: 'Soft wrapped boots.' },
    aura: { name: 'Phantom Step', description: 'Faded copies of you trail a step behind, then vanish.' },
  }),
  ...set('CON', {
    head: { name: 'Great Helm', description: 'A full helm with a narrow sight slit.' },
    shoulders: { name: 'Bastion Plates', description: 'Layered plates built for holding a line.' },
    weapon: { name: 'Aegis of the Watch', description: 'A tall kite shield.' },
    cloak: { name: "Warden's Banner", description: 'A long standard worn from the shoulders.' },
    boots: { name: 'Anchored Greaves', description: 'Weighted plate greaves.' },
    aura: { name: 'Warding Sigils', description: 'Three glyphs circle you, turning as you walk.' },
  }),
  ...set('INT', {
    head: { name: 'Astral Hat', description: 'A star-flecked hat with a wider brim.' },
    shoulders: { name: 'Arcane Sigils', description: 'Runes that hover at each shoulder.' },
    weapon: { name: 'Runewood Staff', description: 'A knotted staff with a larger focus.' },
    cloak: { name: 'Mantle of Constellations', description: 'A deep cloak scattered with stars.' },
    boots: { name: 'Stepping Slippers', description: 'Soft slippers that never quite touch down.' },
    aura: { name: 'Orbiting Grimoire', description: 'An open book circles you, pages turning.' },
  }),
  ...set('WIS', {
    head: { name: 'Crown of Vigil', description: 'A slim circlet worn over the hood.' },
    shoulders: { name: 'Prayer Beads', description: 'Heavy beads looped across the shoulders.' },
    weapon: { name: 'Codex of Dawn', description: 'A gilded tome with a lit page edge.' },
    cloak: { name: "Pilgrim's Mantle", description: 'A long travelling mantle.' },
    boots: { name: 'Wayfarer Sandals', description: 'Bound sandals worn thin by the road.' },
    aura: { name: 'Choir of Rings', description: 'Three haloes nest above you, each turning its own way.' },
  }),
  ...set('CHA', {
    head: { name: 'Plumed Tricorn', description: 'A cocked hat under a long plume.' },
    shoulders: { name: 'Silk Epaulettes', description: 'Fringed silk at each shoulder.' },
    weapon: { name: 'Gilded Lute', description: 'A gold-inlaid lute with a lit rose.' },
    cloak: { name: "Performer's Cape", description: 'A bright lined cape that flares on the turn.' },
    boots: { name: 'Dancer’s Boots', description: 'Cuffed boots with a raised heel.' },
    aura: { name: 'Song Motes', description: 'Notes drift up around you and fade.' },
  }),
];

const BY_ID = new Map(GEAR_ITEMS.map((g) => [g.id, g]));

export function getGear(id: string): GearItem | null {
  return BY_ID.get(id) ?? null;
}

export function getGearForClass(attribute: AttributeKey): GearItem[] {
  return GEAR_ITEMS.filter((g) => g.attribute === attribute);
}

/**
 * The equipped piece per slot for one class. Equipped ids are stored as a flat
 * list, so a class you drift away from keeps its loadout intact for when you
 * come back.
 */
export function getEquippedBySlot(
  equipped: string[],
  attribute: AttributeKey,
): Partial<Record<CosmeticSlot, string>> {
  const bySlot: Partial<Record<CosmeticSlot, string>> = {};
  for (const id of equipped) {
    const gear = getGear(id);
    if (!gear || gear.attribute !== attribute) continue;
    bySlot[gear.slot] = id;
  }
  return bySlot;
}

/** Equipping replaces whatever held that slot for that class, nothing else. */
export function withEquipped(equipped: string[], id: string): string[] {
  const gear = getGear(id);
  if (!gear) return equipped;
  return [
    ...equipped.filter((other) => {
      const o = getGear(other);
      return !o || o.attribute !== gear.attribute || o.slot !== gear.slot;
    }),
    id,
  ];
}

export function withoutEquipped(equipped: string[], id: string): string[] {
  return equipped.filter((other) => other !== id);
}

export function isValidGearId(id: unknown): id is string {
  return typeof id === 'string' && BY_ID.has(id);
}

/** Sanity net so a bad catalog edit can't ship a class with a missing slot. */
export function auditCatalog(): string[] {
  const problems: string[] = [];
  for (const attribute of ATTRIBUTE_KEYS) {
    const owned = getGearForClass(attribute);
    for (const slot of COSMETIC_SLOTS) {
      const matches = owned.filter((g) => g.slot === slot);
      if (matches.length !== 1) problems.push(`${attribute}/${slot}: ${matches.length} items`);
    }
    if (owned.filter((g) => g.legendary).length !== 1) problems.push(`${attribute}: not exactly one legendary`);
  }
  return problems;
}

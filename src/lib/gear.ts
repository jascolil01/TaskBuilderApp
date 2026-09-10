import { CLASS_IDS, type ClassId } from './classes';

/**
 * Cosmetic gear. Each of the twelve classes has one alternative for every slot
 * plus a legendary aura, and every piece is pure vanity — the shop can never
 * sell an advantage, only a look.
 *
 * Gear is locked to the class that wears it, but owning it is permanent: your
 * class follows your attributes, so it can shift on its own, and gear you paid
 * for must never be stranded by that. Pieces for a class you aren't right now
 * are simply hidden until you are again.
 *
 * The original six sets were keyed to attributes rather than classes. They're
 * kept intact here, reassigned to whichever class each set was actually
 * describing — the horned helm and wolfpelt were always a Barbarian, the kite
 * shield and banner always a Fighter — so nobody's purchases were rewritten to
 * make room for the six new sets.
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
  classId: ClassId;
  slot: CosmeticSlot;
  cost: number;
  description: string;
  /** Auras are the one-per-class legendary: spectacle, never a stat. */
  legendary: boolean;
}

/**
 * `idPrefix` exists only for the six original sets, whose ids were minted from
 * an attribute (`str-head`, `con-weapon`). Keeping those ids means a save that
 * already owns them needs no rewriting; new sets take the class id.
 */
function set(
  classId: ClassId,
  entries: Record<CosmeticSlot, { name: string; description: string }>,
  idPrefix: string = classId,
): GearItem[] {
  return COSMETIC_SLOTS.map((slot) => ({
    id: `${idPrefix}-${slot}`,
    name: entries[slot].name,
    classId,
    slot,
    cost: slot === 'aura' ? LEGENDARY_GEAR_COST : GEAR_COST,
    description: entries[slot].description,
    legendary: slot === 'aura',
  }));
}

export const GEAR_ITEMS: GearItem[] = [
  // ---- the six original sets, rehoused ----
  ...set('barbarian', {
    head: { name: 'Dragonhorn Helm', description: 'A horned warhelm with a blackened visor.' },
    shoulders: { name: 'Bulwark Pauldrons', description: 'Spiked plate that squares off the shoulders.' },
    weapon: { name: 'Sunforged Greatsword', description: 'A broader, gold-chased blade.' },
    cloak: { name: 'Wolfpelt Mantle', description: 'Heavy fur that drags behind the stride.' },
    boots: { name: 'Ironshod Sabatons', description: 'Banded steel boots.' },
    aura: { name: 'Ember Wake', description: 'Embers lift from every footfall and burn out behind you.' },
  }, 'str'),
  ...set('ranger', {
    head: { name: 'Shadowed Cowl', description: 'A deep hood that leaves only the eyes.' },
    shoulders: { name: 'Twin Quivers', description: 'Paired quivers crossed at the back.' },
    weapon: { name: "Hunter's Recurve", description: 'A longer bow with swept limbs.' },
    cloak: { name: 'Leafweave Cloak', description: 'A layered cloak cut like foliage.' },
    boots: { name: 'Silent Treads', description: 'Soft wrapped boots.' },
    aura: { name: 'Phantom Step', description: 'Faded copies of you trail a step behind, then vanish.' },
  }, 'dex'),
  ...set('fighter', {
    head: { name: 'Great Helm', description: 'A full helm with a narrow sight slit.' },
    shoulders: { name: 'Bastion Plates', description: 'Layered plates built for holding a line.' },
    weapon: { name: 'Aegis of the Watch', description: 'A tall kite shield.' },
    cloak: { name: "Warden's Banner", description: 'A long standard worn from the shoulders.' },
    boots: { name: 'Anchored Greaves', description: 'Weighted plate greaves.' },
    aura: { name: 'Warding Sigils', description: 'Three glyphs circle you, turning as you walk.' },
  }, 'con'),
  ...set('wizard', {
    head: { name: 'Astral Hat', description: 'A star-flecked hat with a wider brim.' },
    shoulders: { name: 'Arcane Sigils', description: 'Runes that hover at each shoulder.' },
    weapon: { name: 'Runewood Staff', description: 'A knotted staff with a larger focus.' },
    cloak: { name: 'Mantle of Constellations', description: 'A deep cloak scattered with stars.' },
    boots: { name: 'Stepping Slippers', description: 'Soft slippers that never quite touch down.' },
    aura: { name: 'Orbiting Grimoire', description: 'An open book circles you, pages turning.' },
  }, 'int'),
  ...set('cleric', {
    head: { name: 'Crown of Vigil', description: 'A slim circlet worn over the hood.' },
    shoulders: { name: 'Prayer Beads', description: 'Heavy beads looped across the shoulders.' },
    weapon: { name: 'Codex of Dawn', description: 'A gilded tome with a lit page edge.' },
    cloak: { name: "Pilgrim's Mantle", description: 'A long travelling mantle.' },
    boots: { name: 'Wayfarer Sandals', description: 'Bound sandals worn thin by the road.' },
    aura: { name: 'Choir of Rings', description: 'Three haloes nest above you, each turning its own way.' },
  }, 'wis'),
  ...set('bard', {
    head: { name: 'Plumed Tricorn', description: 'A cocked hat under a long plume.' },
    shoulders: { name: 'Silk Epaulettes', description: 'Fringed silk at each shoulder.' },
    weapon: { name: 'Gilded Lute', description: 'A gold-inlaid lute with a lit rose.' },
    cloak: { name: "Performer's Cape", description: 'A bright lined cape that flares on the turn.' },
    boots: { name: 'Dancer’s Boots', description: 'Cuffed boots with a raised heel.' },
    aura: { name: 'Song Motes', description: 'Notes drift up around you and fade.' },
  }, 'cha'),

  // ---- the six new sets ----
  ...set('rogue', {
    head: { name: 'Half-Mask of Whispers', description: 'A blackened mask covering nose and mouth.' },
    shoulders: { name: 'Knife Harness', description: 'A bandolier of throwing blades across the chest.' },
    weapon: { name: 'Paired Fangs', description: 'Two curved daggers, held reversed.' },
    cloak: { name: 'Gutterlight Cloak', description: 'A short cloak that reads as shadow in lamplight.' },
    boots: { name: 'Cutpurse Steps', description: 'Thin-soled boots with no buckle to catch.' },
    aura: { name: 'Coin Sleight', description: 'A stolen coin walks across your knuckles and vanishes.' },
  }),
  ...set('monk', {
    head: { name: 'Ash Circlet', description: 'A plain iron band, worn low on the brow.' },
    shoulders: { name: 'Bound Wraps', description: 'Linen wraps knotted over each shoulder.' },
    weapon: { name: 'Answering Staff', description: 'A worn hardwood staff, held level.' },
    cloak: { name: 'Wandering Sash', description: 'A long sash that trails from the hip.' },
    boots: { name: 'Unshod', description: 'Bare feet and bound ankles.' },
    aura: { name: 'Stilled Water', description: 'Rings spread from each step as though the ground were a pond.' },
  }),
  ...set('paladin', {
    head: { name: 'Oathhelm', description: 'A crowned helm with a raised visor.' },
    shoulders: { name: 'Reliquary Pauldrons', description: 'Plate shoulders set with a sealed relic.' },
    weapon: { name: 'Vow Unbroken', description: 'A longsword with a written oath down the fuller.' },
    cloak: { name: 'Tabard of the Order', description: 'A quartered tabard over full mail.' },
    boots: { name: 'Consecrated Sabatons', description: 'Gilded plate boots, scuffed at the toe.' },
    aura: { name: 'Standing Judgement', description: 'A ring of light holds the ground you stand on.' },
  }),
  ...set('druid', {
    head: { name: 'Antler Crown', description: 'Shed antlers bound into a crown.' },
    shoulders: { name: 'Living Mantle', description: 'Moss and new growth across the shoulders.' },
    weapon: { name: 'Heartwood Branch', description: 'A living branch still holding its leaves.' },
    cloak: { name: 'Cloak of Seasons', description: 'A cloak whose colour turns with the year.' },
    boots: { name: 'Rootbound Wraps', description: 'Bark-and-hide wraps laced to the knee.' },
    aura: { name: 'Circling Swifts', description: 'Three birds wheel around you and never quite land.' },
  }),
  ...set('sorcerer', {
    head: { name: 'Bloodline Diadem', description: 'A thin diadem that catches its own light.' },
    shoulders: { name: 'Scalemail Drape', description: 'Overlapping draconic scale at each shoulder.' },
    weapon: { name: 'Wild Focus', description: 'A raw crystal held in an open palm.' },
    cloak: { name: 'Emberlace Cape', description: 'A cape whose hem never fully cools.' },
    boots: { name: 'Kindled Heels', description: 'Boots that leave a scorch and no print.' },
    aura: { name: 'Untamed Surge', description: 'Loose magic arcs off you at no one’s command, including yours.' },
  }),
  ...set('warlock', {
    head: { name: 'Pactbound Hood', description: 'A hood pinned by a sigil you did not choose.' },
    shoulders: { name: 'Patron’s Grasp', description: 'A clawed shape resting on one shoulder.' },
    weapon: { name: 'Grimoire of Terms', description: 'A chained book that opens only partway.' },
    cloak: { name: 'Veil of the Bargain', description: 'A cloak that hangs as though wind reached it from elsewhere.' },
    boots: { name: 'Threshold Steps', description: 'Boots worn thin from crossing where they shouldn’t.' },
    aura: { name: 'The Watching Eye', description: 'An eye opens above you. It is not looking at what you are.' },
  }),
];

const BY_ID = new Map(GEAR_ITEMS.map((g) => [g.id, g]));

export function getGear(id: string): GearItem | null {
  return BY_ID.get(id) ?? null;
}

export function getGearForClass(classId: ClassId): GearItem[] {
  return GEAR_ITEMS.filter((g) => g.classId === classId);
}

const BY_CLASS_SLOT = new Map(GEAR_ITEMS.map((g) => [`${g.classId}/${g.slot}`, g]));

/**
 * Looks a piece up by class and slot rather than by id. Six sets kept their
 * original attribute-derived ids, so `${classId}-${slot}` is not a reliable
 * id and callers that need "the Barbarian's boots" must come through here.
 */
export function getGearFor(classId: ClassId, slot: CosmeticSlot): GearItem | null {
  return BY_CLASS_SLOT.get(`${classId}/${slot}`) ?? null;
}

/**
 * The equipped piece per slot for one class. Equipped ids are stored as a flat
 * list, so a class you drift away from keeps its loadout intact for when you
 * come back.
 */
export function getEquippedBySlot(
  equipped: string[],
  classId: ClassId,
): Partial<Record<CosmeticSlot, string>> {
  const bySlot: Partial<Record<CosmeticSlot, string>> = {};
  for (const id of equipped) {
    const gear = getGear(id);
    if (!gear || gear.classId !== classId) continue;
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
      return !o || o.classId !== gear.classId || o.slot !== gear.slot;
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
  const seen = new Set<string>();
  for (const item of GEAR_ITEMS) {
    if (seen.has(item.id)) problems.push(`duplicate id: ${item.id}`);
    seen.add(item.id);
  }
  for (const classId of CLASS_IDS) {
    const owned = getGearForClass(classId);
    for (const slot of COSMETIC_SLOTS) {
      const matches = owned.filter((g) => g.slot === slot);
      if (matches.length !== 1) problems.push(`${classId}/${slot}: ${matches.length} items`);
    }
    if (owned.filter((g) => g.legendary).length !== 1) problems.push(`${classId}: not exactly one legendary`);
  }
  return problems;
}

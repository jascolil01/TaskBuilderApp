export type RewardTier = 'minor' | 'standard' | 'major' | 'legendary';

export interface RewardTierInfo {
  label: string;
  cost: number;
  /** Rough time-to-afford at a typical earn rate, shown to set expectations. */
  pace: string;
  hint: string;
}

/**
 * Reward prices are fixed by tier rather than typed in by the player.
 * A free-form price field let you quietly discount your own rewards, which
 * hollows out the whole point of earning them.
 */
export const REWARD_TIERS: Record<RewardTier, RewardTierInfo> = {
  minor: { label: 'Minor', cost: 150, pace: 'a few days', hint: 'A small treat — an episode, a coffee out.' },
  standard: { label: 'Standard', cost: 450, pace: 'a week', hint: 'A proper evening off, takeout, a night out.' },
  major: { label: 'Major', cost: 1200, pace: 'a month', hint: 'Something you genuinely look forward to.' },
  legendary: { label: 'Legendary', cost: 3000, pace: 'two months', hint: 'A real milestone purchase or trip.' },
};

export const REWARD_TIER_ORDER: RewardTier[] = ['minor', 'standard', 'major', 'legendary'];

export function getRewardCost(tier: RewardTier): number {
  return REWARD_TIERS[tier].cost;
}

/** Maps a legacy free-form price onto the closest fixed tier. */
export function inferRewardTier(cost: number): RewardTier {
  let best: RewardTier = 'minor';
  let bestDelta = Number.POSITIVE_INFINITY;
  for (const tier of REWARD_TIER_ORDER) {
    const delta = Math.abs(REWARD_TIERS[tier].cost - cost);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = tier;
    }
  }
  return best;
}

export type ShopItemId = 'streak-save' | 'elixir-of-might' | 'rest-day-token' | 'phoenix-feather';

export interface ShopItem {
  id: ShopItemId;
  name: string;
  icon: string;
  cost: number;
  description: string;
}

export const ELIXIR_COMPLETIONS = 3;

export const SHOP_ITEMS: ShopItem[] = [
  {
    id: 'elixir-of-might',
    name: 'Elixir of Might',
    icon: '⚗️',
    cost: 300,
    description: `Your next ${ELIXIR_COMPLETIONS} completions pay double XP. Gold is unaffected.`,
  },
  {
    id: 'streak-save',
    name: 'Streak Save',
    icon: '🛡️',
    cost: 400,
    description: 'Auto-protects the next quest that would start decaying.',
  },
  {
    id: 'rest-day-token',
    name: 'Rest Day Token',
    icon: '🌙',
    cost: 500,
    description: 'A day off on demand — every quest due that day is forgiven, streaks intact.',
  },
  {
    id: 'phoenix-feather',
    name: 'Phoenix Feather',
    icon: '🪶',
    cost: 900,
    description: 'Restore a broken streak to the length it was before it snapped.',
  },
];

export function getShopItem(id: ShopItemId): ShopItem {
  const item = SHOP_ITEMS.find((i) => i.id === id);
  if (!item) throw new Error(`Unknown shop item: ${id}`);
  return item;
}

export const COSMETIC_COST = 750;

export interface CosmeticTitle {
  id: string;
  label: string;
}

export interface CosmeticRing {
  id: string;
  label: string;
  color: string;
}

/** Pure vanity — a gold sink that can't distort the game's balance. */
export const COSMETIC_TITLES: CosmeticTitle[] = [
  { id: 'unbroken', label: 'the Unbroken' },
  { id: 'dawnbringer', label: 'the Dawnbringer' },
  { id: 'iron-willed', label: 'the Iron-Willed' },
  { id: 'relentless', label: 'the Relentless' },
  { id: 'ever-rising', label: 'the Ever-Rising' },
];

export const COSMETIC_RINGS: CosmeticRing[] = [
  { id: 'crimson', label: 'Crimson', color: '#d64c3f' },
  { id: 'emerald', label: 'Emerald', color: '#63c17a' },
  { id: 'azure', label: 'Azure', color: '#5aa9ec' },
  { id: 'violet', label: 'Violet', color: '#b28ae8' },
  { id: 'obsidian', label: 'Obsidian', color: '#8b8fa3' },
];

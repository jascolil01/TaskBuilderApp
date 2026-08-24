import { useMemo, useState } from 'react';
import { useStore } from '../store';
import type { Habit, Reward } from '../types';
import {
  COSMETIC_COST,
  COSMETIC_RINGS,
  COSMETIC_TITLES,
  getRewardCost,
  REWARD_TIERS,
  SHOP_ITEMS,
} from '../lib/shop';
import { getCharacterClass } from '../lib/rpg';
import { getGearForClass, SLOT_LABELS, type GearItem } from '../lib/gear';
import { AddEditReward } from './AddEditReward';

type Tab = 'rewards' | 'items' | 'gear' | 'cosmetics';

export function Shop() {
  const gold = useStore((s) => s.character.gold);
  const streakSaves = useStore((s) => s.character.streakSaves);
  const inventory = useStore((s) => s.character.inventory);
  const cosmetics = useStore((s) => s.character.cosmetics);
  const rewards = useStore((s) => s.rewards);
  const habits = useStore((s) => s.habits);
  const redeemReward = useStore((s) => s.redeemReward);
  const buyShopItem = useStore((s) => s.buyShopItem);
  const restoreStreakWithFeather = useStore((s) => s.restoreStreakWithFeather);
  const buyCosmetic = useStore((s) => s.buyCosmetic);
  const setCosmetic = useStore((s) => s.setCosmetic);
  const attributes = useStore((s) => s.character.attributes);
  const buyGear = useStore((s) => s.buyGear);
  const setGearEquipped = useStore((s) => s.setGearEquipped);

  const [tab, setTab] = useState<Tab>('rewards');
  const [editing, setEditing] = useState<Reward | 'new' | null>(null);
  const [featherTarget, setFeatherTarget] = useState(false);

  const sortedRewards = useMemo(
    () => [...rewards].sort((a, b) => getRewardCost(a.tier) - getRewardCost(b.tier)),
    [rewards],
  );
  // Only your own class's gear is listed. Everything else would be clutter you
  // couldn't buy anyway, and it stays waiting if your class ever changes back.
  const { attribute: classAttribute, className } = useMemo(() => getCharacterClass(attributes), [attributes]);
  const classGear = useMemo(() => getGearForClass(classAttribute), [classAttribute]);

  const restorable = useMemo(
    () => habits.filter((h) => !h.archived && (h.lastBrokenStreak ?? 0) > 0),
    [habits],
  );

  const ownedCount = (id: string) => {
    switch (id) {
      case 'streak-save':
        return streakSaves;
      case 'elixir-of-might':
        return inventory.elixirCompletions;
      case 'rest-day-token':
        return inventory.restDayTokens;
      case 'phoenix-feather':
        return inventory.phoenixFeathers;
      default:
        return 0;
    }
  };
  const ownedLabel = (id: string) => {
    const n = ownedCount(id);
    if (id === 'elixir-of-might') return n > 0 ? `${n} double-XP uses banked` : null;
    return n > 0 ? `You own ${n}` : null;
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: 'rewards', label: 'Rewards' },
    { key: 'items', label: 'Items' },
    { key: 'gear', label: 'Gear' },
    { key: 'cosmetics', label: 'Cosmetics' },
  ];

  return (
    <div className="flex flex-col gap-4 px-4 pb-28 pt-6">
      <h1 className="font-display text-xl font-bold text-gold-300">Reward Shop</h1>

      <div className="parchment-border flex items-center justify-center gap-2 rounded-xl bg-ink-800/60 py-3">
        <span className="text-xl">🪙</span>
        <span className="font-display text-lg font-bold text-gold-300">{gold}</span>
        <span className="text-sm text-white/50">gold</span>
      </div>

      <div className="flex gap-1.5">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors ${
              tab === t.key ? 'border-gold-500 bg-gold-500/15 text-gold-300' : 'border-white/15 text-white/50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'rewards' && (
        <>
          <button
            onClick={() => setEditing('new')}
            className="rounded-full border border-gold-500/60 bg-gold-500/10 px-4 py-2 text-sm font-medium text-gold-300 active:scale-95"
          >
            + New Reward
          </button>

          {sortedRewards.length === 0 ? (
            <EmptyState icon="🏪" title="No rewards yet" body="Add something you actually want to work toward." />
          ) : (
            <div className="flex flex-col gap-2.5">
              {sortedRewards.map((reward) => {
                const cost = getRewardCost(reward.tier);
                const affordable = gold >= cost;
                return (
                  <div key={reward.id} className="parchment-border flex items-center gap-3 rounded-xl bg-ink-800/50 p-3.5">
                    <button className="min-w-0 flex-1 text-left" onClick={() => setEditing(reward)}>
                      <p className="truncate font-medium text-white/90">{reward.name}</p>
                      <p className="mt-0.5 text-xs text-gold-400/80">
                        {REWARD_TIERS[reward.tier].label} · 🪙 {cost}
                      </p>
                      {!affordable && (
                        <p className="mt-0.5 text-[11px] text-white/30">{cost - gold} more gold to go</p>
                      )}
                    </button>
                    <BuyButton label="Redeem" disabled={!affordable} onClick={() => redeemReward(reward.id)} />
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {tab === 'items' && (
        <div className="flex flex-col gap-2.5">
          {SHOP_ITEMS.map((item) => {
            const affordable = gold >= item.cost;
            const owned = ownedLabel(item.id);
            const isFeather = item.id === 'phoenix-feather';
            return (
              <div key={item.id} className="parchment-border rounded-xl bg-ink-800/50 p-3.5">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{item.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-white/90">{item.name}</p>
                    <p className="mt-0.5 text-[11px] text-white/40">{item.description}</p>
                    {owned && <p className="mt-0.5 text-[11px] text-verdant-400">{owned}</p>}
                    {!affordable && (
                      <p className="mt-0.5 text-[11px] text-white/30">{item.cost - gold} more gold to go</p>
                    )}
                  </div>
                  <BuyButton
                    label={`🪙${item.cost}`}
                    disabled={!affordable}
                    onClick={() => buyShopItem(item.id)}
                  />
                </div>

                {isFeather && inventory.phoenixFeathers > 0 && (
                  <div className="mt-3 border-t border-white/10 pt-3">
                    {restorable.length === 0 ? (
                      <p className="text-[11px] text-white/30">No broken streaks to restore right now.</p>
                    ) : !featherTarget ? (
                      <button
                        onClick={() => setFeatherTarget(true)}
                        className="w-full rounded-lg border border-gold-500/50 py-2 text-xs font-medium text-gold-300"
                      >
                        Use a feather ({restorable.length} restorable)
                      </button>
                    ) : (
                      <div className="flex flex-col gap-1.5">
                        <p className="text-[11px] uppercase tracking-wide text-white/40">Restore which streak?</p>
                        {restorable.map((h: Habit) => (
                          <button
                            key={h.id}
                            onClick={() => {
                              restoreStreakWithFeather(h.id);
                              setFeatherTarget(false);
                            }}
                            className="flex items-center justify-between rounded-lg bg-ink-900/60 px-3 py-2 text-sm"
                          >
                            <span className="truncate text-white/80">{h.name}</span>
                            <span className="shrink-0 text-xs text-gold-300">🔥 {h.lastBrokenStreak}</span>
                          </button>
                        ))}
                        <button
                          onClick={() => setFeatherTarget(false)}
                          className="mt-1 text-[11px] text-white/40"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {tab === 'gear' && (
        <div className="flex flex-col gap-3">
          <p className="text-[11px] text-white/35">
            Gear for your {className}. It changes how your character looks and nothing else. Other classes' gear
            is hidden — if your highest attribute changes, that class's gear appears here instead, and anything
            you've bought is waiting for you when you come back.
          </p>

          {classGear.map((gear) => (
            <GearRow
              key={gear.id}
              gear={gear}
              owned={cosmetics.unlockedGear.includes(gear.id)}
              equipped={cosmetics.equippedGear.includes(gear.id)}
              gold={gold}
              onBuy={() => buyGear(gear.id)}
              onToggle={(next) => setGearEquipped(gear.id, next)}
            />
          ))}
        </div>
      )}

      {tab === 'cosmetics' && (
        <div className="flex flex-col gap-4">
          <p className="text-[11px] text-white/35">
            Pure vanity — {COSMETIC_COST} gold each, and none of it affects the game.
          </p>

          <CosmeticGroup
            heading="Titles"
            items={COSMETIC_TITLES.map((c) => ({ id: c.id, label: c.label }))}
            owned={cosmetics.unlockedTitles}
            active={cosmetics.activeTitle}
            gold={gold}
            onBuy={(id) => buyCosmetic('title', id)}
            onToggle={(id) => setCosmetic('title', cosmetics.activeTitle === id ? null : id)}
          />

          <CosmeticGroup
            heading="Avatar rings"
            items={COSMETIC_RINGS.map((c) => ({ id: c.id, label: c.label, swatch: c.color }))}
            owned={cosmetics.unlockedRings}
            active={cosmetics.activeRing}
            gold={gold}
            onBuy={(id) => buyCosmetic('ring', id)}
            onToggle={(id) => setCosmetic('ring', cosmetics.activeRing === id ? null : id)}
          />
        </div>
      )}

      {editing && <AddEditReward reward={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function GearRow({
  gear,
  owned,
  equipped,
  gold,
  onBuy,
  onToggle,
}: {
  gear: GearItem;
  owned: boolean;
  equipped: boolean;
  gold: number;
  onBuy: () => void;
  onToggle: (next: boolean) => void;
}) {
  return (
    <div
      className={`parchment-border rounded-xl p-3.5 ${
        gear.legendary ? 'bg-gold-500/[0.07] ring-1 ring-gold-400/40' : 'bg-ink-800/50'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-[10px] uppercase tracking-widest text-white/35">{SLOT_LABELS[gear.slot]}</span>
            {gear.legendary && (
              <span className="rounded-full bg-gold-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gold-300">
                Legendary
              </span>
            )}
          </div>
          <p className={`font-display font-semibold ${gear.legendary ? 'text-gold-300' : 'text-white/85'}`}>
            {gear.name}
          </p>
          <p className="mt-0.5 text-[11px] text-white/45">{gear.description}</p>
        </div>
        {owned ? (
          <button
            onClick={() => onToggle(!equipped)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold active:scale-95 ${
              equipped ? 'bg-gold-500 text-ink-950' : 'border border-white/20 text-white/70'
            }`}
          >
            {equipped ? 'Worn' : 'Wear'}
          </button>
        ) : (
          <BuyButton label={`${gear.cost} 🪙`} disabled={gold < gear.cost} onClick={onBuy} />
        )}
      </div>
    </div>
  );
}

function BuyButton({ label, disabled, onClick }: { label: string; disabled: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-all active:scale-95 ${
        disabled ? 'cursor-not-allowed bg-white/5 text-white/30' : 'bg-gold-500 text-ink-950'
      }`}
    >
      {label}
    </button>
  );
}

function EmptyState({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div className="parchment-border rounded-2xl bg-ink-800/50 p-6 text-center text-white/60">
      <p className="text-3xl">{icon}</p>
      <p className="mt-2 font-display text-gold-300">{title}</p>
      <p className="mt-1 text-sm">{body}</p>
    </div>
  );
}

function CosmeticGroup({
  heading,
  items,
  owned,
  active,
  gold,
  onBuy,
  onToggle,
}: {
  heading: string;
  items: { id: string; label: string; swatch?: string }[];
  owned: string[];
  active: string | null;
  gold: number;
  onBuy: (id: string) => void;
  onToggle: (id: string) => void;
}) {
  return (
    <div>
      <h2 className="font-display text-sm uppercase tracking-widest text-white/50">{heading}</h2>
      <div className="mt-2 flex flex-col gap-2">
        {items.map((item) => {
          const isOwned = owned.includes(item.id);
          const isActive = active === item.id;
          return (
            <div key={item.id} className="parchment-border flex items-center gap-3 rounded-xl bg-ink-800/50 p-3">
              {item.swatch && (
                <span
                  className="h-6 w-6 shrink-0 rounded-full border-2"
                  style={{ borderColor: item.swatch }}
                  aria-hidden
                />
              )}
              <span className="min-w-0 flex-1 truncate text-sm text-white/85">{item.label}</span>
              {isOwned ? (
                <button
                  onClick={() => onToggle(item.id)}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${
                    isActive ? 'bg-gold-500 text-ink-950' : 'border border-white/20 text-white/60'
                  }`}
                >
                  {isActive ? 'Equipped' : 'Equip'}
                </button>
              ) : (
                <BuyButton label={`🪙${COSMETIC_COST}`} disabled={gold < COSMETIC_COST} onClick={() => onBuy(item.id)} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

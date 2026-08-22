import { useState } from 'react';
import { useStore } from '../store';
import type { Reward } from '../types';
import { STREAK_SAVE_COST } from '../lib/rpg';
import { AddEditReward } from './AddEditReward';

export function Shop() {
  const gold = useStore((s) => s.character.gold);
  const streakSaves = useStore((s) => s.character.streakSaves);
  const rewards = useStore((s) => s.rewards);
  const redemptions = useStore((s) => s.redemptions);
  const redeemReward = useStore((s) => s.redeemReward);
  const buyStreakSave = useStore((s) => s.buyStreakSave);
  const [editing, setEditing] = useState<Reward | 'new' | null>(null);
  const canAffordStreakSave = gold >= STREAK_SAVE_COST;

  const sorted = [...rewards].sort((a, b) => a.cost - b.cost);
  const recentRedemptions = [...redemptions].reverse().slice(0, 5);

  return (
    <div className="flex flex-col gap-4 px-4 pb-28 pt-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-bold text-gold-300">Reward Shop</h1>
        <button
          onClick={() => setEditing('new')}
          className="rounded-full border border-gold-500/60 bg-gold-500/10 px-4 py-1.5 text-sm font-medium text-gold-300 active:scale-95"
        >
          + New Reward
        </button>
      </div>

      <div className="parchment-border flex items-center justify-center gap-2 rounded-xl bg-ink-800/60 py-3">
        <span className="text-xl">🪙</span>
        <span className="font-display text-lg font-bold text-gold-300">{gold}</span>
        <span className="text-sm text-white/50">gold</span>
      </div>

      <div className="parchment-border flex items-center gap-3 rounded-xl bg-ink-800/50 p-3.5">
        <span className="text-2xl">🛡️</span>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-white/90">Streak Save</p>
          <p className="mt-0.5 text-xs text-white/40">
            Auto-protects the next quest that would start decaying. You own {streakSaves}.
          </p>
        </div>
        <button
          onClick={buyStreakSave}
          disabled={!canAffordStreakSave}
          className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-all active:scale-95 ${
            canAffordStreakSave ? 'bg-gold-500 text-ink-950' : 'cursor-not-allowed bg-white/5 text-white/30'
          }`}
        >
          🪙{STREAK_SAVE_COST}
        </button>
      </div>

      {sorted.length === 0 ? (
        <div className="parchment-border mt-2 rounded-2xl bg-ink-800/50 p-6 text-center text-white/60">
          <p className="text-3xl">🏪</p>
          <p className="mt-2 font-display text-gold-300">The shop is empty</p>
          <p className="mt-1 text-sm">Add a reward to spend the gold you earn from quests on.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {sorted.map((reward) => {
            const affordable = gold >= reward.cost;
            return (
              <div key={reward.id} className="parchment-border flex items-center gap-3 rounded-xl bg-ink-800/50 p-3.5">
                <button className="min-w-0 flex-1 text-left" onClick={() => setEditing(reward)}>
                  <p className="truncate font-medium text-white/90">{reward.name}</p>
                  <p className="mt-0.5 text-xs text-gold-400/80">🪙 {reward.cost} gold</p>
                </button>
                <button
                  onClick={() => redeemReward(reward.id)}
                  disabled={!affordable}
                  className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-all active:scale-95 ${
                    affordable
                      ? 'bg-gold-500 text-ink-950'
                      : 'cursor-not-allowed bg-white/5 text-white/30'
                  }`}
                >
                  Redeem
                </button>
              </div>
            );
          })}
        </div>
      )}

      {recentRedemptions.length > 0 && (
        <div className="mt-2">
          <h2 className="font-display text-sm uppercase tracking-widest text-white/50">Recently redeemed</h2>
          <div className="mt-2 flex flex-col gap-2">
            {recentRedemptions.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-lg bg-ink-800/30 px-3 py-2 text-sm">
                <span className="text-white/70">{r.rewardName}</span>
                <span className="text-white/40">{r.date} · 🪙 {r.cost}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {editing && <AddEditReward reward={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

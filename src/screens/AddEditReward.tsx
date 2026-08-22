import { useState } from 'react';
import { useStore } from '../store';
import type { Reward } from '../types';
import { REWARD_TIER_ORDER, REWARD_TIERS, type RewardTier } from '../lib/shop';

export function AddEditReward({ reward, onClose }: { reward: Reward | null; onClose: () => void }) {
  const addReward = useStore((s) => s.addReward);
  const updateReward = useStore((s) => s.updateReward);
  const deleteReward = useStore((s) => s.deleteReward);

  const [name, setName] = useState(reward?.name ?? '');
  const [tier, setTier] = useState<RewardTier>(reward?.tier ?? 'standard');

  const canSave = name.trim().length > 0;

  const handleSave = () => {
    if (!canSave) return;
    if (reward) {
      updateReward(reward.id, { name, tier });
    } else {
      addReward({ name, tier });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
      <div className="max-h-[92dvh] w-full max-w-[560px] overflow-y-auto rounded-t-3xl border-t border-gold-500/40 bg-ink-900 p-5 pb-8">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />
        <h2 className="font-display text-lg font-bold text-gold-300">{reward ? 'Edit Reward' : 'New Reward'}</h2>

        <label className="mt-5 block text-xs uppercase tracking-wide text-white/50">Reward name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Movie night"
          maxLength={60}
          className="mt-1.5 w-full rounded-lg border border-white/15 bg-ink-800 px-3 py-2.5 text-white outline-none focus:border-gold-500/70"
        />

        <label className="mt-5 block text-xs uppercase tracking-wide text-white/50">How big a reward is it?</label>
        <p className="mt-0.5 text-[11px] text-white/30">
          The price is set by the tier — pick honestly and it stays worth earning.
        </p>
        <div className="mt-2 flex flex-col gap-2">
          {REWARD_TIER_ORDER.map((key) => {
            const info = REWARD_TIERS[key];
            const selected = tier === key;
            return (
              <button
                key={key}
                onClick={() => setTier(key)}
                className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${
                  selected ? 'border-gold-500 bg-gold-500/15' : 'border-white/15'
                }`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className={`font-display font-semibold ${selected ? 'text-gold-300' : 'text-white/70'}`}>
                    {info.label}
                  </span>
                  <span className={`text-sm ${selected ? 'text-gold-300' : 'text-white/50'}`}>
                    🪙 {info.cost}
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] text-white/35">
                  {info.hint} · about {info.pace} to earn
                </p>
              </button>
            );
          })}
        </div>

        <div className="mt-7 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-white/15 py-2.5 text-sm font-medium text-white/70"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="flex-1 rounded-lg bg-gold-500 py-2.5 text-sm font-semibold text-ink-950 disabled:opacity-40"
          >
            {reward ? 'Save changes' : 'Add reward'}
          </button>
        </div>

        {reward && (
          <button
            onClick={() => {
              if (confirm('Delete this reward?')) {
                deleteReward(reward.id);
                onClose();
              }
            }}
            className="mt-3 w-full rounded-lg border border-blood-500/40 py-2 text-xs text-blood-400"
          >
            Delete reward
          </button>
        )}
      </div>
    </div>
  );
}

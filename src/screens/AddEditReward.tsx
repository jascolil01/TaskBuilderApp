import { useState } from 'react';
import { useStore } from '../store';
import type { Reward } from '../types';

export function AddEditReward({ reward, onClose }: { reward: Reward | null; onClose: () => void }) {
  const addReward = useStore((s) => s.addReward);
  const updateReward = useStore((s) => s.updateReward);
  const deleteReward = useStore((s) => s.deleteReward);

  const [name, setName] = useState(reward?.name ?? '');
  const [cost, setCost] = useState(reward?.cost ?? 50);

  const canSave = name.trim().length > 0 && cost > 0;

  const handleSave = () => {
    if (!canSave) return;
    if (reward) {
      updateReward(reward.id, { name, cost });
    } else {
      addReward({ name, cost });
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

        <label className="mt-5 block text-xs uppercase tracking-wide text-white/50">
          Cost: {cost} gold
        </label>
        <input
          type="range"
          min={10}
          max={500}
          step={10}
          value={cost}
          onChange={(e) => setCost(Number(e.target.value))}
          className="mt-2 w-full accent-[var(--color-gold-500)]"
        />

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

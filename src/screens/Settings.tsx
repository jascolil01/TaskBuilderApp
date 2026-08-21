import { useStore } from '../store';

export function Settings({ onClose }: { onClose: () => void }) {
  const characterName = useStore((s) => s.character.name);
  const resetAll = useStore((s) => s.resetAll);

  const handleReset = () => {
    const confirmed = confirm(
      `Reset everything? This permanently deletes ${characterName || 'your character'}, all attributes, gold, quests, quest history, and rewards. This cannot be undone.`,
    );
    if (!confirmed) return;
    resetAll();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-[560px] rounded-t-3xl border-t border-gold-500/40 bg-ink-900 p-5 pb-8">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />
        <h2 className="font-display text-lg font-bold text-gold-300">Settings</h2>

        <div className="mt-6 rounded-xl border border-blood-500/40 bg-blood-500/5 p-4">
          <h3 className="font-display text-sm font-semibold text-blood-400">Danger zone</h3>
          <p className="mt-1 text-sm text-white/50">
            Wipe your character, quests, gold, and history, and start over from a fresh, unnamed character. This
            cannot be undone.
          </p>
          <button
            onClick={handleReset}
            className="mt-3 w-full rounded-lg border border-blood-500/50 bg-blood-500/15 py-2.5 text-sm font-semibold text-blood-400 active:scale-95"
          >
            Reset everything
          </button>
        </div>

        <button
          onClick={onClose}
          className="mt-4 w-full rounded-lg border border-white/15 py-2.5 text-sm font-medium text-white/70"
        >
          Close
        </button>
      </div>
    </div>
  );
}

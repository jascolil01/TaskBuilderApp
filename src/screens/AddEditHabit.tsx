import { useState } from 'react';
import { useStore } from '../store';
import type { AttributeKey, Frequency, Habit } from '../types';
import { ATTRIBUTE_INFO, ATTRIBUTE_KEYS } from '../lib/rpg';
import { weekdayLabel } from '../lib/date';

export function AddEditHabit({ habit, onClose }: { habit: Habit | null; onClose: () => void }) {
  const addHabit = useStore((s) => s.addHabit);
  const updateHabit = useStore((s) => s.updateHabit);
  const archiveHabit = useStore((s) => s.archiveHabit);
  const deleteHabit = useStore((s) => s.deleteHabit);
  const completions = useStore((s) => s.completions);

  const [name, setName] = useState(habit?.name ?? '');
  const [attribute, setAttribute] = useState<AttributeKey>(habit?.attribute ?? 'STR');
  const [isDaily, setIsDaily] = useState(habit ? habit.frequency.type === 'daily' : true);
  const [days, setDays] = useState<number[]>(
    habit && habit.frequency.type === 'weekly' ? habit.frequency.days : [1, 2, 3, 4, 5],
  );
  const [graceDays, setGraceDays] = useState(habit?.graceDays ?? 2);
  const [xpReward, setXpReward] = useState(habit?.xpReward ?? 15);

  const toggleDay = (d: number) => setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));

  const canSave = name.trim().length > 0 && (isDaily || days.length > 0);

  const handleSave = () => {
    if (!canSave) return;
    const frequency: Frequency = isDaily ? { type: 'daily' } : { type: 'weekly', days };
    if (habit) {
      updateHabit(habit.id, { name, attribute, frequency, graceDays, xpReward });
    } else {
      addHabit({ name, attribute, frequency, graceDays, xpReward });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
      <div className="max-h-[92dvh] w-full max-w-[560px] overflow-y-auto rounded-t-3xl border-t border-gold-500/40 bg-ink-900 p-5 pb-8">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />
        <h2 className="font-display text-lg font-bold text-gold-300">{habit ? 'Edit Quest' : 'New Quest'}</h2>

        <label className="mt-5 block text-xs uppercase tracking-wide text-white/50">Quest name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Morning run"
          maxLength={60}
          className="mt-1.5 w-full rounded-lg border border-white/15 bg-ink-800 px-3 py-2.5 text-white outline-none focus:border-gold-500/70"
        />

        <label className="mt-5 block text-xs uppercase tracking-wide text-white/50">Trains attribute</label>
        <div className="mt-1.5 grid grid-cols-3 gap-2">
          {ATTRIBUTE_KEYS.map((key) => {
            const info = ATTRIBUTE_INFO[key];
            const selected = attribute === key;
            return (
              <button
                key={key}
                onClick={() => setAttribute(key)}
                className={`rounded-lg border px-2 py-2 text-xs font-medium transition-colors ${
                  selected ? 'border-gold-500 bg-gold-500/15 text-gold-300' : 'border-white/15 text-white/60'
                }`}
              >
                {info.label}
              </button>
            );
          })}
        </div>

        <label className="mt-5 block text-xs uppercase tracking-wide text-white/50">Schedule</label>
        <div className="mt-1.5 flex gap-2">
          <button
            onClick={() => setIsDaily(true)}
            className={`flex-1 rounded-lg border px-3 py-2 text-sm ${
              isDaily ? 'border-gold-500 bg-gold-500/15 text-gold-300' : 'border-white/15 text-white/60'
            }`}
          >
            Every day
          </button>
          <button
            onClick={() => setIsDaily(false)}
            className={`flex-1 rounded-lg border px-3 py-2 text-sm ${
              !isDaily ? 'border-gold-500 bg-gold-500/15 text-gold-300' : 'border-white/15 text-white/60'
            }`}
          >
            Specific days
          </button>
        </div>
        {!isDaily && (
          <div className="mt-2 flex justify-between gap-1">
            {[0, 1, 2, 3, 4, 5, 6].map((d) => (
              <button
                key={d}
                onClick={() => toggleDay(d)}
                className={`h-9 w-9 rounded-full border text-xs ${
                  days.includes(d) ? 'border-gold-500 bg-gold-500/15 text-gold-300' : 'border-white/15 text-white/50'
                }`}
              >
                {weekdayLabel(d)[0]}
              </button>
            ))}
          </div>
        )}

        <label className="mt-5 block text-xs uppercase tracking-wide text-white/50">
          Grace period before skills decay: {graceDays} day{graceDays === 1 ? '' : 's'}
        </label>
        <input
          type="range"
          min={0}
          max={7}
          value={graceDays}
          onChange={(e) => setGraceDays(Number(e.target.value))}
          className="mt-2 w-full accent-[var(--color-gold-500)]"
        />
        <p className="mt-1 text-[11px] text-white/40">
          Miss this quest for more than {graceDays} scheduled day{graceDays === 1 ? '' : 's'} in a row and its
          attribute starts losing XP each day until you complete it again.
        </p>

        <label className="mt-5 block text-xs uppercase tracking-wide text-white/50">XP reward: {xpReward}</label>
        <input
          type="range"
          min={5}
          max={50}
          step={5}
          value={xpReward}
          onChange={(e) => setXpReward(Number(e.target.value))}
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
            {habit ? 'Save changes' : 'Create quest'}
          </button>
        </div>

        {habit && (
          <div className="mt-3 flex gap-2">
            {!habit.archived && (
              <button
                onClick={() => {
                  archiveHabit(habit.id);
                  onClose();
                }}
                className="flex-1 rounded-lg border border-white/10 py-2 text-xs text-white/50"
              >
                Archive quest
              </button>
            )}
            <button
              onClick={() => {
                // Deleting also drops every completion logged against this
                // quest, which erases it from the Chronicle and takes its
                // contribution to this week's boss with it. That's a bigger
                // deal than "and its history" was letting on.
                const logged = completions.filter((c) => c.habitId === habit.id).length;
                const detail = logged
                  ? `This erases ${logged} logged completion${logged === 1 ? '' : 's'} from your Chronicle and this week's boss progress.`
                  : 'It has no logged completions yet.';
                if (
                  confirm(
                    `Delete "${habit.name}"?\n\n${detail}\n\nYour character keeps the XP and gold it already earned. To stop tracking a quest but keep its history, use Archive instead.\n\nThis cannot be undone.`,
                  )
                ) {
                  deleteHabit(habit.id);
                  onClose();
                }
              }}
              className="flex-1 rounded-lg border border-blood-500/40 py-2 text-xs text-blood-400"
            >
              Delete quest
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

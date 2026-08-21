import { useMemo, useState } from 'react';
import { useStore } from '../store';
import type { Habit } from '../types';
import { HabitCard } from '../components/HabitCard';
import { todayStr } from '../lib/date';
import { AddEditHabit } from './AddEditHabit';

export function QuestLog() {
  const habits = useStore((s) => s.habits);
  const [editing, setEditing] = useState<Habit | 'new' | null>(null);

  const active = habits.filter((h) => !h.archived);
  const archived = habits.filter((h) => h.archived);
  const today = todayStr();

  const sorted = useMemo(
    () =>
      [...active].sort((a, b) => {
        const aDone = a.lastCompletedDate === today ? 1 : 0;
        const bDone = b.lastCompletedDate === today ? 1 : 0;
        if (aDone !== bDone) return aDone - bDone;
        return a.name.localeCompare(b.name);
      }),
    [active, today],
  );

  return (
    <div className="flex flex-col gap-4 px-4 pb-28 pt-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-bold text-gold-300">Quest Log</h1>
        <button
          onClick={() => setEditing('new')}
          className="rounded-full border border-gold-500/60 bg-gold-500/10 px-4 py-1.5 text-sm font-medium text-gold-300 active:scale-95"
        >
          + New Quest
        </button>
      </div>

      {sorted.length === 0 ? (
        <div className="parchment-border mt-4 rounded-2xl bg-ink-800/50 p-6 text-center text-white/60">
          <p className="text-3xl">📜</p>
          <p className="mt-2 font-display text-gold-300">Your quest log is empty</p>
          <p className="mt-1 text-sm">Add a habit to start earning XP and training your character.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {sorted.map((h) => (
            <HabitCard key={h.id} habit={h} onEdit={setEditing} />
          ))}
        </div>
      )}

      {archived.length > 0 && (
        <details className="mt-2 text-white/50">
          <summary className="cursor-pointer text-sm">Archived quests ({archived.length})</summary>
          <div className="mt-2 flex flex-col gap-2.5">
            {archived.map((h) => (
              <HabitCard key={h.id} habit={h} onEdit={setEditing} />
            ))}
          </div>
        </details>
      )}

      {editing && <AddEditHabit habit={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

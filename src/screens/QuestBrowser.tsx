import { useMemo, useState } from 'react';
import { useStore } from '../store';
import type { AttributeKey } from '../types';
import { ATTRIBUTE_INFO, ATTRIBUTE_KEYS } from '../lib/rpg';
import { EFFORT_TIERS } from '../lib/effort';
import { getTemplatesFor, type QuestTemplate } from '../lib/questCatalog';
import { weekdayLabel } from '../lib/date';

function scheduleLabel(t: QuestTemplate): string {
  if (t.frequency.type === 'daily') return 'Every day';
  const d = [...t.frequency.days].sort((a, b) => a - b);
  if (d.length === 5 && d.every((x, i) => x === i + 1)) return 'Weekdays';
  return d.map(weekdayLabel).join(' · ');
}

/**
 * Browse ready-made quests instead of facing an empty form. Grouped by
 * attribute, which also quietly explains what each attribute is for.
 */
export function QuestBrowser({ onClose }: { onClose: () => void }) {
  const habits = useStore((s) => s.habits);
  const addFromTemplates = useStore((s) => s.addFromTemplates);
  const [attribute, setAttribute] = useState<AttributeKey>('CON');
  const [picked, setPicked] = useState<Set<string>>(new Set());

  // Anything already on your list is shown as such rather than offered again.
  const owned = useMemo(
    () => new Set(habits.map((h) => h.name.trim().toLowerCase())),
    [habits],
  );
  const templates = useMemo(() => getTemplatesFor(attribute), [attribute]);
  const info = ATTRIBUTE_INFO[attribute];

  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const handleAdd = () => {
    if (picked.size === 0) return;
    addFromTemplates([...picked]);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
      <div className="flex max-h-[92dvh] w-full max-w-[560px] flex-col rounded-t-3xl border-t border-gold-500/40 bg-ink-900">
        <div className="shrink-0 px-5 pt-5">
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />
          <h2 className="font-display text-lg font-bold text-gold-300">Quest ideas</h2>
          <p className="mt-1 text-xs text-white/40">
            Ready to go — schedule, difficulty and grace period already set. Tap any you want.
          </p>

          <div className="mt-3 grid grid-cols-3 gap-1.5">
            {ATTRIBUTE_KEYS.map((key) => {
              const selected = attribute === key;
              return (
                <button
                  key={key}
                  onClick={() => setAttribute(key)}
                  className={`rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors ${
                    selected ? 'text-ink-950' : 'border-white/15 text-white/55'
                  }`}
                  style={
                    selected
                      ? { background: ATTRIBUTE_INFO[key].color, borderColor: ATTRIBUTE_INFO[key].color }
                      : undefined
                  }
                >
                  {ATTRIBUTE_INFO[key].label}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-[11px] text-white/35">{info.description}</p>
        </div>

        <div className="mt-3 flex-1 overflow-y-auto px-5">
          <div className="flex flex-col gap-2 pb-3">
            {templates.map((t) => {
              const already = owned.has(t.name.trim().toLowerCase());
              const selected = picked.has(t.id);
              return (
                <button
                  key={t.id}
                  onClick={() => !already && toggle(t.id)}
                  disabled={already}
                  className={`rounded-xl border p-3 text-left transition-colors ${
                    already
                      ? 'cursor-not-allowed border-white/8 opacity-40'
                      : selected
                        ? 'border-gold-500 bg-gold-500/15'
                        : 'border-white/12 bg-ink-800/40'
                  }`}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className={`font-medium ${selected ? 'text-gold-300' : 'text-white/85'}`}>
                      {already ? '✓ ' : ''}
                      {t.name}
                    </span>
                    <span className="shrink-0 text-[11px] text-white/40">
                      {EFFORT_TIERS[t.effort].label} · {EFFORT_TIERS[t.effort].xp} XP
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-white/40">{t.note}</p>
                  <p className="mt-1 text-[10px] uppercase tracking-wide text-white/25">
                    {already ? 'Already on your list' : `${scheduleLabel(t)} · ${t.graceDays} day grace`}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="shrink-0 border-t border-white/10 bg-ink-900 px-5 pb-8 pt-3">
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 rounded-lg border border-white/15 py-2.5 text-sm font-medium text-white/70"
            >
              Close
            </button>
            <button
              onClick={handleAdd}
              disabled={picked.size === 0}
              className="flex-1 rounded-lg bg-gold-500 py-2.5 text-sm font-semibold text-ink-950 disabled:opacity-40"
            >
              {picked.size === 0 ? 'Pick some' : `Add ${picked.size}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

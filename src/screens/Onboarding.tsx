import { useState } from 'react';
import { useStore } from '../store';
import { ATTRIBUTE_INFO } from '../lib/rpg';
import { EFFORT_TIERS } from '../lib/effort';
import { getStarterTemplates } from '../lib/questCatalog';

export function Onboarding() {
  const startJourney = useStore((s) => s.startJourney);
  const [step, setStep] = useState<'name' | 'quests'>('name');
  const [name, setName] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const starters = getStarterTemplates();

  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (step === 'name') {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-6 px-6 text-center">
        <div className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-gold-500/70 bg-gradient-to-b from-ink-700 to-ink-900 text-5xl shadow-inner">
          🛡️
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold text-gold-300">Questlog</h1>
          <p className="mt-2 text-sm text-white/60">
            Every habit you keep trains your character. Every habit you neglect makes them weaker.
            <br />
            Name your hero to begin.
          </p>
        </div>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={24}
          placeholder="Character name"
          className="w-full max-w-xs rounded-lg border border-white/15 bg-ink-800 px-4 py-3 text-center text-white outline-none focus:border-gold-500/70"
          onKeyDown={(e) => {
            if (e.key === 'Enter') setStep('quests');
          }}
        />
        <button
          onClick={() => setStep('quests')}
          className="w-full max-w-xs rounded-lg bg-gold-500 py-3 font-display font-semibold text-ink-950 active:scale-95"
        >
          Continue
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh] flex-col px-5 pb-8 pt-10">
      <h1 className="font-display text-xl font-bold text-gold-300">Choose your first quests</h1>
      <p className="mt-1.5 text-sm text-white/50">
        Pick two or three to start — small ones you'd feel silly skipping. You can add more, edit them, or write
        your own at any time.
      </p>

      <div className="mt-4 flex flex-1 flex-col gap-2 overflow-y-auto">
        {starters.map((t) => {
          const selected = picked.has(t.id);
          const info = ATTRIBUTE_INFO[t.attribute];
          return (
            <button
              key={t.id}
              onClick={() => toggle(t.id)}
              className={`rounded-xl border p-3 text-left transition-colors ${
                selected ? 'border-gold-500 bg-gold-500/15' : 'border-white/12 bg-ink-800/40'
              }`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className={`font-medium ${selected ? 'text-gold-300' : 'text-white/85'}`}>
                  {selected ? '✓ ' : ''}
                  {t.name}
                </span>
                <span className="shrink-0 text-[11px]" style={{ color: info.color }}>
                  {info.label}
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-white/40">{t.note}</p>
              <p className="mt-1 text-[10px] uppercase tracking-wide text-white/25">
                {EFFORT_TIERS[t.effort].label} · {EFFORT_TIERS[t.effort].time}
              </p>
            </button>
          );
        })}
      </div>

      <div className="mt-4 shrink-0">
        <button
          onClick={() => startJourney(name, [...picked])}
          className="w-full rounded-lg bg-gold-500 py-3 font-display font-semibold text-ink-950 active:scale-95"
        >
          {picked.size === 0 ? 'Start with a few basics' : `Begin with ${picked.size} quest${picked.size === 1 ? '' : 's'}`}
        </button>
        <p className="mt-2 text-center text-[11px] text-white/30">
          Nothing here is permanent — quests can be edited, archived or deleted later.
        </p>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { useStore } from '../store';

export function Onboarding() {
  const setCharacterName = useStore((s) => s.setCharacterName);
  const [name, setName] = useState('');

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
          if (e.key === 'Enter' && name.trim()) setCharacterName(name);
        }}
      />
      <button
        onClick={() => setCharacterName(name || 'Adventurer')}
        className="w-full max-w-xs rounded-lg bg-gold-500 py-3 font-display font-semibold text-ink-950 active:scale-95"
      >
        Begin your quest
      </button>
    </div>
  );
}

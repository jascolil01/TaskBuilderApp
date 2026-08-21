import { useMemo } from 'react';
import { useStore } from '../store';
import { ATTRIBUTE_INFO, ATTRIBUTE_KEYS, getCharacterClass, getCharacterLevel, xpToNextLevel } from '../lib/rpg';
import { isAtRisk, isDecaying } from '../lib/rpg';
import { XpBar } from '../components/XpBar';

export function CharacterSheet() {
  const character = useStore((s) => s.character);
  const allHabits = useStore((s) => s.habits);
  const habits = useMemo(() => allHabits.filter((h) => !h.archived), [allHabits]);

  const level = useMemo(() => getCharacterLevel(character.attributes), [character.attributes]);
  const { className } = useMemo(() => getCharacterClass(character.attributes), [character.attributes]);

  const totalXp = ATTRIBUTE_KEYS.reduce((sum, k) => sum + character.attributes[k].xp, 0);
  const avgProgressPct = useMemo(() => {
    const sum = ATTRIBUTE_KEYS.reduce((acc, k) => {
      const a = character.attributes[k];
      return acc + a.xp / xpToNextLevel(a.level);
    }, 0);
    return Math.min(100, Math.round((sum / ATTRIBUTE_KEYS.length) * 100));
  }, [character.attributes]);
  const decayingCount = habits.filter(isDecaying).length;
  const atRiskCount = habits.filter(isAtRisk).length;

  return (
    <div className="flex flex-col gap-5 px-4 pb-28 pt-6">
      <div className="parchment-border rounded-2xl bg-ink-800/60 p-5 text-center">
        <div className="mx-auto mb-3 flex h-20 w-20 items-center justify-center rounded-full border-2 border-gold-500/70 bg-gradient-to-b from-ink-700 to-ink-900 text-3xl shadow-inner">
          🛡️
        </div>
        <h1 className="font-display text-xl font-bold text-gold-300">{character.name || 'Adventurer'}</h1>
        <p className="mt-1 text-sm text-gold-400/80">
          Level {level} {className}
        </p>
        <div className="mt-4">
          <XpBar level={level} xp={0} pct={avgProgressPct} color="var(--color-gold-500)" height={12} />
        </div>
        <p className="mt-2 text-xs text-white/50">{totalXp} total experience earned</p>
      </div>

      {(decayingCount > 0 || atRiskCount > 0) && (
        <div className="rounded-xl border border-blood-500/50 bg-blood-500/10 px-4 py-3 text-sm">
          {decayingCount > 0 && (
            <p className="text-blood-400">
              ⚠ {decayingCount} skill{decayingCount > 1 ? 's are' : ' is'} decaying from neglect
            </p>
          )}
          {atRiskCount > 0 && (
            <p className="mt-1 text-gold-400/90">
              ⏳ {atRiskCount} quest{atRiskCount > 1 ? 's' : ''} at risk of decay soon
            </p>
          )}
        </div>
      )}

      <div className="flex flex-col gap-3">
        <h2 className="font-display text-sm uppercase tracking-widest text-white/50">Attributes</h2>
        {ATTRIBUTE_KEYS.map((key) => {
          const attr = character.attributes[key];
          const info = ATTRIBUTE_INFO[key];
          return (
            <div key={key} className="parchment-border rounded-xl bg-ink-800/50 p-3">
              <div className="flex items-baseline justify-between">
                <div>
                  <span className="font-display font-semibold" style={{ color: info.color }}>
                    {info.label}
                  </span>
                  <span className="ml-2 text-xs text-white/40">{info.description}</span>
                </div>
                <span className="font-display text-sm text-white/80">Lv {attr.level}</span>
              </div>
              <div className="mt-2">
                <XpBar level={attr.level} xp={attr.xp} color={info.color} />
              </div>
              <div className="mt-1 text-right text-[11px] text-white/35">
                {attr.xp} / {xpToNextLevel(attr.level)} XP
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

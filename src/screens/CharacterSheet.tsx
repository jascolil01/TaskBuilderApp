import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../store';
import type { AttributeKey } from '../types';
import { ATTRIBUTE_INFO, ATTRIBUTE_KEYS, getCharacterClass, getCharacterLevel, getTier, xpToNextLevel } from '../lib/rpg';
import { getNextPerk, getUnlockedPerks, isAtRisk, isDecaying } from '../lib/rpg';
import { XpBar } from '../components/XpBar';
import { Avatar } from '../components/Avatar';
import { WalkingCharacter } from '../components/WalkingCharacter';
import { BossBattleCard } from '../components/BossBattleCard';
import { Settings } from './Settings';
import { ShareCard } from './ShareCard';

export function CharacterSheet() {
  const character = useStore((s) => s.character);
  const allHabits = useStore((s) => s.habits);
  const habits = useMemo(() => allHabits.filter((h) => !h.archived), [allHabits]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const level = useMemo(() => getCharacterLevel(character.attributes), [character.attributes]);
  const { attribute: dominantAttribute, className } = useMemo(
    () => getCharacterClass(character.attributes),
    [character.attributes],
  );
  const tier = useMemo(() => getTier(level), [level]);

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

  const prevLevelsRef = useRef<Record<AttributeKey, number> | null>(null);
  const [pulsing, setPulsing] = useState<Set<AttributeKey>>(new Set());

  useEffect(() => {
    const snapshot = ATTRIBUTE_KEYS.reduce(
      (acc, k) => ({ ...acc, [k]: character.attributes[k].level }),
      {} as Record<AttributeKey, number>,
    );
    const prev = prevLevelsRef.current;
    prevLevelsRef.current = snapshot;
    if (!prev) return;

    const leveled = ATTRIBUTE_KEYS.filter((k) => snapshot[k] > prev[k]);
    if (leveled.length === 0) return;
    setPulsing(new Set(leveled));
    const timer = setTimeout(() => setPulsing(new Set()), 1400);
    return () => clearTimeout(timer);
  }, [character.attributes]);

  return (
    <div className="flex flex-col gap-5 px-4 pb-28 pt-6">
      <div className="flex justify-end gap-2">
        <button
          onClick={() => setShareOpen(true)}
          aria-label="Share character card"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-white/50 active:scale-90"
        >
          ⤴
        </button>
        <button
          onClick={() => setSettingsOpen(true)}
          aria-label="Settings"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-white/50 active:scale-90"
        >
          ⚙
        </button>
      </div>

      <div className="parchment-border -mt-3 rounded-2xl bg-ink-800/60 p-5 text-center">
        <div className="mb-3">
          <Avatar attribute={dominantAttribute} level={level} size={84} />
        </div>
        <p className="text-[10px] uppercase tracking-widest" style={{ color: tier.ring }}>
          {tier.name} tier
        </p>
        <h1 className="font-display text-xl font-bold text-gold-300">{character.name || 'Adventurer'}</h1>
        <p className="mt-1 text-sm text-gold-400/80">
          Level {level} {className}
        </p>
        <div className="mt-4">
          <XpBar level={level} xp={0} pct={avgProgressPct} color="var(--color-gold-500)" height={12} />
        </div>
        <p className="mt-2 text-xs text-white/50">{totalXp} total experience earned</p>
        <div className="mt-3 flex items-center justify-center gap-2">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-ink-900/60 px-3 py-1 text-sm">
            <span>🪙</span>
            <span className="font-display font-semibold text-gold-300">{character.gold}</span>
            <span className="text-xs text-white/40">gold</span>
          </div>
          {character.streakSaves > 0 && (
            <div className="inline-flex items-center gap-1.5 rounded-full bg-ink-900/60 px-3 py-1 text-sm">
              <span>🛡️</span>
              <span className="font-display font-semibold text-white/80">{character.streakSaves}</span>
              <span className="text-xs text-white/40">streak saves</span>
            </div>
          )}
        </div>
      </div>

      <WalkingCharacter attribute={dominantAttribute} />

      <BossBattleCard />

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
          const unlockedPerks = getUnlockedPerks(key, attr.level);
          const nextPerk = getNextPerk(key, attr.level);
          const justLeveled = pulsing.has(key);
          return (
            <div
              key={key}
              className={`parchment-border rounded-xl bg-ink-800/50 p-3 transition-shadow duration-500 ${
                justLeveled ? 'ring-2 ring-gold-300 shadow-[0_0_20px_rgba(246,211,101,0.45)]' : ''
              }`}
            >
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

              {unlockedPerks.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {unlockedPerks.map((perk) => (
                    <span
                      key={perk.level}
                      title={perk.description}
                      className="rounded-full px-2 py-0.5 text-[11px] font-medium"
                      style={{ background: `color-mix(in srgb, ${info.color} 20%, transparent)`, color: info.color }}
                    >
                      {perk.name}
                    </span>
                  ))}
                </div>
              )}
              {nextPerk && (
                <p className="mt-1.5 text-[11px] text-white/30">
                  Next perk at Lv {nextPerk.level}: {nextPerk.name}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {settingsOpen && <Settings onClose={() => setSettingsOpen(false)} />}
      {shareOpen && <ShareCard onClose={() => setShareOpen(false)} />}
    </div>
  );
}

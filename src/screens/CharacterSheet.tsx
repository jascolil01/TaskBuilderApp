import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../store';
import type { AttributeKey } from '../types';
import {
  ATTRIBUTE_INFO,
  ATTRIBUTE_KEYS,
  CLASS_BY_ATTRIBUTE,
  getCharacterClass,
  getCharacterProgress,
  getTier,
  xpToNextLevel,
} from '../lib/rpg';
import { getNextPerk, getUnlockedPerks, isAtRisk, isDecaying } from '../lib/rpg';
import { XpBar } from '../components/XpBar';
import { Avatar } from '../components/Avatar';
import { BossBattleCard } from '../components/BossBattleCard';
import { CheatDayCard } from '../components/CheatDayCard';
import { VacationCard } from '../components/VacationCard';
import { COSMETIC_RINGS, COSMETIC_TITLES } from '../lib/shop';

// Three.js is a heavy dependency (~500KB) — load it only when this screen
// actually renders the 3D widget, not as part of the app's initial bundle.
const WalkingCharacter3D = lazy(() =>
  import('../components/WalkingCharacter3D').then((m) => ({ default: m.WalkingCharacter3D })),
);
import { Settings } from './Settings';
import { ShareCard } from './ShareCard';

export function CharacterSheet() {
  const character = useStore((s) => s.character);
  const allHabits = useStore((s) => s.habits);
  const habits = useMemo(() => allHabits.filter((h) => !h.archived), [allHabits]);
  const setPreferredClass = useStore((s) => s.setPreferredClass);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const progress = useMemo(() => getCharacterProgress(character.lifetimeXp), [character.lifetimeXp]);
  const level = progress.level;
  const { attribute: dominantAttribute, className, tied } = useMemo(
    () => getCharacterClass(character.attributes, character.preferredClass),
    [character.attributes, character.preferredClass],
  );
  const tier = useMemo(() => getTier(level), [level]);
  const equippedTitle = useMemo(
    () => COSMETIC_TITLES.find((t) => t.id === character.cosmetics.activeTitle)?.label ?? null,
    [character.cosmetics.activeTitle],
  );
  const equippedRing = useMemo(
    () => COSMETIC_RINGS.find((r) => r.id === character.cosmetics.activeRing)?.color,
    [character.cosmetics.activeRing],
  );

  // Lifetime XP is a monotonic counter on the character rather than a sum
  // over completions, so deleting a quest can't retroactively demote you.
  const totalXp = character.lifetimeXp;
  const decayingCount = habits.filter((h) => isDecaying(h, character.attributes)).length;
  const atRiskCount = habits.filter((h) => isAtRisk(h, character.attributes)).length;

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
          <Avatar attribute={dominantAttribute} level={level} size={84} ringColor={equippedRing} />
        </div>
        <p className="text-[10px] uppercase tracking-widest" style={{ color: tier.ring }}>
          {tier.name} tier
        </p>
        <h1 className="font-display text-xl font-bold text-gold-300">
          {character.name || 'Adventurer'}
          {equippedTitle && <span className="text-gold-400/80">, {equippedTitle}</span>}
        </h1>
        <p className="mt-1 text-sm text-gold-400/80">
          Level {level} {className}
        </p>
        {tied.length > 1 && (
          <div className="mt-2">
            <p className="text-[10px] uppercase tracking-widest text-white/30">
              {tied.length} attributes tied — choose your class
            </p>
            <div className="mt-1.5 flex flex-wrap justify-center gap-1.5">
              {tied.map((key) => (
                <button
                  key={key}
                  onClick={() => setPreferredClass(key)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    key === dominantAttribute
                      ? 'text-ink-950'
                      : 'border border-white/15 text-white/55'
                  }`}
                  style={key === dominantAttribute ? { background: ATTRIBUTE_INFO[key].color } : undefined}
                >
                  {CLASS_BY_ATTRIBUTE[key]}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="mt-4">
          <XpBar level={level} xp={progress.xpIntoLevel} pct={Math.round((progress.xpIntoLevel / progress.xpForNext) * 100)} color="var(--color-gold-500)" height={12} />
        </div>
        <p className="mt-2 text-xs text-white/50">
          {progress.xpIntoLevel} / {progress.xpForNext} XP to level {level + 1} · {totalXp} earned all-time
        </p>
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

      <Suspense fallback={<div className="h-40 w-full rounded-xl border border-white/10 bg-ink-950/50" />}>
        <WalkingCharacter3D attribute={dominantAttribute} equipped={character.cosmetics.equippedGear} />
      </Suspense>

      <VacationCard />

      <BossBattleCard />

      <CheatDayCard />

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
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        perk.signature ? 'ring-1 ring-gold-300/70' : ''
                      }`}
                      style={{ background: `color-mix(in srgb, ${info.color} 20%, transparent)`, color: info.color }}
                    >
                      {perk.signature ? `✦ ${perk.name}` : perk.name}
                    </span>
                  ))}
                </div>
              )}
              {nextPerk && (
                <p className="mt-1.5 text-[11px] text-white/30">
                  Next at Lv {nextPerk.level}: <span className="text-white/45">{nextPerk.name}</span> —{' '}
                  {nextPerk.description}
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

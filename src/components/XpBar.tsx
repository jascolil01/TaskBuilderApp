import { xpToNextLevel } from '../lib/rpg';

export function XpBar({
  level,
  xp,
  color = 'var(--color-gold-500)',
  height = 10,
  pct: pctOverride,
}: {
  level: number;
  xp: number;
  color?: string;
  height?: number;
  pct?: number;
}) {
  const next = xpToNextLevel(level);
  const pct = pctOverride ?? Math.min(100, Math.round((xp / next) * 100));
  return (
    <div className="w-full rounded-full bg-ink-900/70 overflow-hidden" style={{ height, background: 'rgba(0,0,0,0.35)' }}>
      <div
        className="h-full rounded-full transition-all duration-500 ease-out"
        style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}, color-mix(in srgb, ${color} 60%, white))` }}
      />
    </div>
  );
}

import type { AttributeKey } from '../types';
import { ATTRIBUTE_INFO, getTier } from '../lib/rpg';
import { EMBLEMS } from './emblems';

export function Avatar({
  attribute,
  level,
  size = 80,
  ringColor,
}: {
  attribute: AttributeKey;
  level: number;
  size?: number;
  /** Cosmetic override for the level-tier ring colour. */
  ringColor?: string;
}) {
  const info = ATTRIBUTE_INFO[attribute];
  const tier = getTier(level);
  const ring = ringColor ?? tier.ring;

  return (
    <div
      className="relative mx-auto flex items-center justify-center rounded-full bg-gradient-to-b from-ink-700 to-ink-900 shadow-inner"
      style={{ width: size, height: size, border: `3px solid ${ring}` }}
      title={`${tier.name} tier`}
    >
      <svg viewBox="0 0 64 64" width={size * 0.56} height={size * 0.56} style={{ color: info.color }}>
        {EMBLEMS[attribute]}
      </svg>
    </div>
  );
}

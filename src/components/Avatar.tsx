import type { ReactNode } from 'react';
import type { AttributeKey } from '../types';
import { ATTRIBUTE_INFO, getTier } from '../lib/rpg';

const EMBLEMS: Record<AttributeKey, ReactNode> = {
  // Warrior — sword
  STR: (
    <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4">
      <path d="M32 6 V40" />
      <path d="M32 6 L26 15 H38 Z" strokeWidth="3" />
      <path d="M21 40 H43" />
      <path d="M32 40 V52" />
      <circle cx="32" cy="55" r="3" strokeWidth="3" />
    </g>
  ),
  // Rogue — crossed daggers
  DEX: (
    <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4">
      <path d="M14 14 L44 44" />
      <path d="M19 9 L9 19" strokeWidth="3.5" />
      <path d="M50 14 L20 44" />
      <path d="M45 9 L55 19" strokeWidth="3.5" />
    </g>
  ),
  // Guardian — shield with cross
  CON: (
    <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3">
      <path d="M32 6 L50 14 V29 C50 43 42 52 32 57 C22 52 14 43 14 29 V14 Z" />
      <path d="M32 20 V46" />
      <path d="M20 27 H44" />
    </g>
  ),
  // Wizard — hat and wand
  INT: (
    <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3">
      <path d="M32 6 L46 38 H18 Z" />
      <path d="M13 38 H51" strokeWidth="3.5" />
      <circle cx="32" cy="18" r="1.8" fill="currentColor" stroke="none" />
      <path d="M38 46 L54 60" strokeWidth="4" />
      <path d="M50 48 L54 44 M56 54 L60 50 M52 58 L48 62" strokeWidth="2" />
    </g>
  ),
  // Cleric — radiant holy symbol
  WIS: (
    <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3">
      <circle cx="32" cy="32" r="17" />
      <path d="M32 21 V43" />
      <path d="M21 32 H43" />
      <path d="M32 6 V12 M32 52 V58 M6 32 H12 M52 32 H58" strokeWidth="2.5" />
    </g>
  ),
  // Bard — lute and note
  CHA: (
    <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3">
      <circle cx="24" cy="42" r="13" />
      <path d="M24 29 V10" />
      <path d="M17 10 H30" strokeWidth="3.5" />
      <ellipse cx="45" cy="46" rx="4.5" ry="3.5" fill="currentColor" stroke="none" />
      <path d="M49.5 46 V16" />
      <path d="M49.5 16 Q59 18 54 28" />
    </g>
  ),
};

export function Avatar({
  attribute,
  level,
  size = 80,
}: {
  attribute: AttributeKey;
  level: number;
  size?: number;
}) {
  const info = ATTRIBUTE_INFO[attribute];
  const tier = getTier(level);

  return (
    <div
      className="relative mx-auto flex items-center justify-center rounded-full bg-gradient-to-b from-ink-700 to-ink-900 shadow-inner"
      style={{ width: size, height: size, border: `3px solid ${tier.ring}` }}
      title={`${tier.name} tier`}
    >
      <svg viewBox="0 0 64 64" width={size * 0.56} height={size * 0.56} style={{ color: info.color }}>
        {EMBLEMS[attribute]}
      </svg>
    </div>
  );
}

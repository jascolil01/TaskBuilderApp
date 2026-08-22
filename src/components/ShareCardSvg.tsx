import { forwardRef, useMemo } from 'react';
import type { Attributes, AttributeKey } from '../types';
import { ATTRIBUTE_INFO, ATTRIBUTE_KEYS, getTier, xpToNextLevel } from '../lib/rpg';
import { EMBLEMS } from './emblems';

// This SVG gets serialized and rasterized standalone (via a detached Image,
// not the live document), so `var(--color-x)` custom properties can't
// resolve — they only work while attached to the page's DOM tree. Every
// color needs to be a literal value here.
function resolveColor(value: string): string {
  const match = value.match(/^var\((--[\w-]+)\)$/);
  if (!match) return value;
  if (typeof window === 'undefined') return value;
  const resolved = getComputedStyle(document.documentElement).getPropertyValue(match[1]).trim();
  return resolved || value;
}

export const ShareCardSvg = forwardRef<
  SVGSVGElement,
  {
    name: string;
    level: number;
    className: string;
    dominantAttribute: AttributeKey;
    attributes: Attributes;
    gold: number;
  }
>(function ShareCardSvg({ name, level, className, dominantAttribute, attributes, gold }, ref) {
  const tier = useMemo(() => {
    const t = getTier(level);
    return { ...t, ring: resolveColor(t.ring) };
  }, [level]);
  const attrColors = useMemo(
    () =>
      ATTRIBUTE_KEYS.reduce(
        (acc, k) => ({ ...acc, [k]: resolveColor(ATTRIBUTE_INFO[k].color) }),
        {} as Record<AttributeKey, string>,
      ),
    [],
  );

  const avgProgressPct = Math.min(
    100,
    Math.round(
      (ATTRIBUTE_KEYS.reduce((acc, k) => acc + attributes[k].xp / xpToNextLevel(attributes[k].level), 0) /
        ATTRIBUTE_KEYS.length) *
        100,
    ),
  );

  return (
    <svg
      ref={ref}
      viewBox="0 0 400 600"
      width="400"
      height="600"
      xmlns="http://www.w3.org/2000/svg"
      className="block h-auto w-full"
    >
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#241736" />
          <stop offset="1" stopColor="#0b0713" />
        </linearGradient>
        <linearGradient id="xpfill" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#c9922b" />
          <stop offset="1" stopColor="#f6d365" />
        </linearGradient>
      </defs>

      <rect x="0" y="0" width="400" height="600" fill="url(#bg)" />
      <rect x="10" y="10" width="380" height="580" rx="16" fill="none" stroke="#c9922b" strokeOpacity="0.5" strokeWidth="1.5" />

      <text x="200" y="42" textAnchor="middle" fontFamily="Cinzel, serif" fontSize="13" letterSpacing="4" fill="#c9922b">
        QUESTLOG
      </text>

      <circle cx="200" cy="150" r="72" fill="#1a1128" stroke={tier.ring} strokeWidth="4" />
      <svg x="150" y="100" width="100" height="100" viewBox="0 0 64 64" style={{ color: attrColors[dominantAttribute] }}>
        {EMBLEMS[dominantAttribute]}
      </svg>

      <text x="200" y="256" textAnchor="middle" fontFamily="Cinzel, serif" fontSize="9" letterSpacing="3" fill={tier.ring}>
        {tier.name.toUpperCase()} TIER
      </text>
      <text x="200" y="288" textAnchor="middle" fontFamily="Cinzel, serif" fontSize="26" fontWeight="700" fill="#f6d365">
        {name || 'Adventurer'}
      </text>
      <text x="200" y="312" textAnchor="middle" fontFamily="Inter, sans-serif" fontSize="14" fill="#e8bf4a">
        Level {level} {className}
      </text>

      <rect x="60" y="330" width="280" height="10" rx="5" fill="rgba(0,0,0,0.35)" />
      <rect x="60" y="330" width={2.8 * avgProgressPct} height="10" rx="5" fill="url(#xpfill)" />

      <text x="200" y="362" textAnchor="middle" fontFamily="Inter, sans-serif" fontSize="12" fill="#e8bf4a">
        🪙 {gold} gold
      </text>

      {ATTRIBUTE_KEYS.map((key, i) => {
        const attr = attributes[key];
        const attrInfo = ATTRIBUTE_INFO[key];
        const col = i % 3;
        const row = Math.floor(i / 3);
        const x = 55 + col * 100;
        const y = 400 + row * 90;
        return (
          <g key={key}>
            <circle cx={x + 30} cy={y} r="24" fill="#1a1128" stroke={attrColors[key]} strokeWidth="2.5" />
            <svg x={x + 14} y={y - 16} width="32" height="32" viewBox="0 0 64 64" style={{ color: attrColors[key] }}>
              {EMBLEMS[key]}
            </svg>
            <text x={x + 30} y={y + 40} textAnchor="middle" fontFamily="Inter, sans-serif" fontSize="10" fill="rgba(255,255,255,0.6)">
              {attrInfo.label}
            </text>
            <text x={x + 30} y={y + 54} textAnchor="middle" fontFamily="Cinzel, serif" fontSize="12" fontWeight="700" fill="#fff">
              Lv {attr.level}
            </text>
          </g>
        );
      })}

      <text x="200" y="580" textAnchor="middle" fontFamily="Inter, sans-serif" fontSize="10" fill="rgba(255,255,255,0.3)">
        Built with Questlog
      </text>
    </svg>
  );
});

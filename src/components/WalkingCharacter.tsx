import type { ReactNode } from 'react';
import type { AttributeKey } from '../types';
import { ATTRIBUTE_INFO } from '../lib/rpg';

// Small class accessory, fixed near the head/shoulder — reuses the same
// silhouette language as the Avatar emblems so a class reads consistently
// across the app.
const ACCESSORIES: Record<AttributeKey, ReactNode> = {
  STR: <path d="M34 8 L42 0 M42 0 L38 0 M42 0 L42 4" strokeWidth="2.5" />,
  DEX: <path d="M32 10 L40 4 M40 4 L37 4 M40 4 L40 7" strokeWidth="2.2" />,
  CON: <path d="M6 20 C2 20 2 30 6 32 C10 30 10 20 6 20 Z" strokeWidth="2.2" />,
  INT: <path d="M20 0 L26 8 H14 Z" strokeWidth="2.2" />,
  WIS: <ellipse cx="20" cy="-2" rx="8" ry="2.5" strokeWidth="2" />,
  CHA: <ellipse cx="34" cy="24" rx="3.5" ry="2.8" fill="currentColor" stroke="none" />,
};

export function WalkingCharacter({ attribute }: { attribute: AttributeKey }) {
  const info = ATTRIBUTE_INFO[attribute];

  return (
    <div className="relative h-24 w-full overflow-hidden rounded-xl border border-white/10 bg-ink-950/50">
      <div className="absolute inset-x-3 bottom-2 top-2 border-b border-dashed border-white/5" />
      <div className="ql-walk-figure absolute bottom-2" style={{ color: info.color }}>
        <div className="ql-walk-bob">
          <svg viewBox="0 0 48 64" width="34" height="46">
            <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3">
              <circle cx="24" cy="10" r="6" />
              <path d="M24 16 V38" />
              <g className="ql-frame-a">
                <path d="M24 38 L18 58" />
                <path d="M24 38 L32 50" />
                <path d="M24 20 L30 34" />
                <path d="M24 20 L16 30" />
              </g>
              <g className="ql-frame-b">
                <path d="M24 38 L30 58" />
                <path d="M24 38 L16 50" />
                <path d="M24 20 L18 34" />
                <path d="M24 20 L32 30" />
              </g>
              {ACCESSORIES[attribute]}
            </g>
          </svg>
        </div>
      </div>
    </div>
  );
}

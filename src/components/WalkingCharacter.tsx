import type { ReactNode } from 'react';
import type { AttributeKey } from '../types';
import { ATTRIBUTE_INFO } from '../lib/rpg';

// Small class accessory, fixed near the head/shoulder — reuses the same
// silhouette language as the Avatar emblems so a class reads consistently
// across the app.
const ACCESSORIES: Record<AttributeKey, ReactNode> = {
  STR: <path d="M34 6 L42 -2 M42 -2 L38 -2 M42 -2 L42 2" strokeWidth="2.5" />,
  DEX: <path d="M32 8 L40 2 M40 2 L37 2 M40 2 L40 5" strokeWidth="2.2" />,
  CON: <path d="M4 18 C0 18 0 28 4 30 C8 28 8 18 4 18 Z" strokeWidth="2.2" />,
  INT: <path d="M20 -3 L26 5 H14 Z" strokeWidth="2.2" />,
  WIS: <ellipse cx="24" cy="-3" rx="8" ry="2.5" strokeWidth="2" />,
  CHA: <ellipse cx="34" cy="22" rx="3.5" ry="2.8" fill="currentColor" stroke="none" />,
};

export function WalkingCharacter({ attribute }: { attribute: AttributeKey }) {
  const info = ATTRIBUTE_INFO[attribute];

  return (
    <div className="relative h-24 w-full overflow-hidden rounded-xl border border-white/10 bg-ink-950/50">
      <div className="absolute inset-x-3 bottom-2 top-2 border-b border-dashed border-white/5" />
      <div className="ql-walk-figure absolute bottom-2" style={{ color: info.color }}>
        <div className="ql-walk-bob">
          <svg viewBox="0 0 48 64" width="36" height="48" overflow="visible">
            {/* legs — hinge at the hip, continuous eased swing */}
            <rect className="ql-leg-l" x="15" y="36" width="8" height="23" rx="4" fill="currentColor" fillOpacity="0.18" stroke="currentColor" strokeWidth="2.5" />
            <rect className="ql-leg-r" x="25" y="36" width="8" height="23" rx="4" fill="currentColor" fillOpacity="0.18" stroke="currentColor" strokeWidth="2.5" />

            {/* body */}
            <rect x="15" y="14" width="18" height="25" rx="9" fill="currentColor" fillOpacity="0.18" stroke="currentColor" strokeWidth="2.5" />
            <circle cx="24" cy="8" r="8" fill="currentColor" fillOpacity="0.18" stroke="currentColor" strokeWidth="2.5" />

            {/* arms — hinge at the shoulder */}
            <rect className="ql-arm-l" x="13" y="17" width="6" height="19" rx="3" fill="currentColor" fillOpacity="0.18" stroke="currentColor" strokeWidth="2.2" />
            <rect className="ql-arm-r" x="29" y="17" width="6" height="19" rx="3" fill="currentColor" fillOpacity="0.18" stroke="currentColor" strokeWidth="2.2" />

            <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
              {ACCESSORIES[attribute]}
            </g>
          </svg>
        </div>
      </div>
    </div>
  );
}

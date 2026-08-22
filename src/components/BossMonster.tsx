export function BossMonster({ color, size = 56 }: { color: string; size?: number }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} style={{ color }}>
      <g fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 38 C10 26 18 12 32 12 C46 12 54 26 50 38 C48 46 40 52 32 52 C24 52 16 46 14 38 Z" />
        <path d="M22 12 L17 3 M42 12 L47 3" />
        <circle cx="24" cy="28" r="2.2" fill="currentColor" stroke="none" />
        <circle cx="40" cy="28" r="2.2" fill="currentColor" stroke="none" />
        <path d="M18 40 L22 45 L26 40 L30 45 L34 40 L38 45 L42 40" strokeWidth="2.5" />
      </g>
    </svg>
  );
}

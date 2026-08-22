import type { DailyXp } from '../lib/history';
import { todayStr } from '../lib/date';

export function XpHistoryChart({ data }: { data: DailyXp[] }) {
  const width = 328;
  const height = 110;
  const barGap = 4;
  const barWidth = (width - barGap * (data.length - 1)) / data.length;
  const maxXp = Math.max(1, ...data.map((d) => d.xp));
  const today = todayStr();

  return (
    <div className="parchment-border rounded-xl bg-ink-800/50 p-4">
      <h3 className="font-display text-sm uppercase tracking-widest text-white/50">
        XP earned — last {data.length} days
      </h3>
      <svg
        viewBox={`0 0 ${width} ${height + 14}`}
        className="mt-3 w-full"
        role="img"
        aria-label={`Daily experience earned over the last ${data.length} days`}
      >
        <line x1={0} y1={height} x2={width} y2={height} stroke="rgba(255,255,255,0.12)" strokeWidth={1} />
        {data.map((d, i) => {
          const x = i * (barWidth + barGap);
          const barHeight = d.xp > 0 ? Math.max(3, (d.xp / maxXp) * (height - 10)) : 0;
          const isToday = d.date === today;
          const isMax = d.xp === maxXp && d.xp > 0;
          return (
            <g key={d.date}>
              <rect
                x={x}
                y={height - barHeight}
                width={barWidth}
                height={barHeight}
                rx={Math.min(3, barWidth / 2)}
                fill={isToday ? 'var(--color-gold-300)' : 'var(--color-gold-600)'}
              />
              {(isMax || isToday) && d.xp > 0 && (
                <text
                  x={x + barWidth / 2}
                  y={height - barHeight - 4}
                  textAnchor="middle"
                  fontSize="9"
                  fill="rgba(255,255,255,0.55)"
                >
                  {d.xp}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-white/30">
        <span>{data[0]?.date.slice(5)}</span>
        <span className="text-gold-300/70">today</span>
      </div>
    </div>
  );
}

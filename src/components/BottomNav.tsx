export type Screen = 'character' | 'quests';

export function BottomNav({ screen, onChange }: { screen: Screen; onChange: (s: Screen) => void }) {
  const items: { key: Screen; label: string; icon: string }[] = [
    { key: 'character', label: 'Character', icon: '🛡️' },
    { key: 'quests', label: 'Quests', icon: '📜' },
  ];

  return (
    <nav className="fixed bottom-0 left-1/2 z-40 w-full max-w-[560px] -translate-x-1/2 border-t border-gold-500/25 bg-ink-950/95 backdrop-blur">
      <div className="flex" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {items.map((item) => (
          <button
            key={item.key}
            onClick={() => onChange(item.key)}
            className={`flex flex-1 flex-col items-center gap-0.5 py-3 text-xs transition-colors ${
              screen === item.key ? 'text-gold-300' : 'text-white/40'
            }`}
          >
            <span className="text-lg leading-none">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </div>
    </nav>
  );
}

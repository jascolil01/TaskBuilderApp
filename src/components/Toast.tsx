import { useToastStore } from '../toastStore';

export function Toast() {
  const message = useToastStore((s) => s.message);
  const clear = useToastStore((s) => s.clear);

  if (!message) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex justify-center px-4">
      <button
        onClick={clear}
        className="pointer-events-auto parchment-border max-w-full rounded-full bg-ink-900/95 px-4 py-2.5 text-center text-sm font-medium text-gold-300 shadow-lg backdrop-blur"
      >
        {message}
      </button>
    </div>
  );
}

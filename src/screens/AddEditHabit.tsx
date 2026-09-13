import { useState } from 'react';
import { useStore } from '../store';
import {
  EFFORT_ORDER,
  EFFORT_TIERS,
  type EffortTier,
  getEffortGold,
  inferEffort,
} from '../lib/effort';
import type { AttributeKey, Frequency, Habit } from '../types';
import { ATTRIBUTE_INFO, ATTRIBUTE_KEYS } from '../lib/rpg';
import { getAffinities, resolveSecondary, SECONDARY_SHARE } from '../lib/affinity';
import { daysUntilWake, HIBERNATE_OPTIONS, isHibernating } from '../lib/hibernate';
import { weekdayLabel } from '../lib/date';

export function AddEditHabit({ habit, onClose }: { habit: Habit | null; onClose: () => void }) {
  const addHabit = useStore((s) => s.addHabit);
  const updateHabit = useStore((s) => s.updateHabit);
  const archiveHabit = useStore((s) => s.archiveHabit);
  const hibernateHabit = useStore((s) => s.hibernateHabit);
  const wakeHabit = useStore((s) => s.wakeHabit);
  const [sleepOpen, setSleepOpen] = useState(false);
  const deleteHabit = useStore((s) => s.deleteHabit);
  const completions = useStore((s) => s.completions);

  const [name, setName] = useState(habit?.name ?? '');
  const [attribute, setAttribute] = useState<AttributeKey>(habit?.attribute ?? 'STR');
  const [secondary, setSecondary] = useState<AttributeKey | null>(habit?.secondary ?? null);
  // Changing the primary can strand the secondary, so the options are derived
  // and the selection is re-checked rather than left to go stale.
  const asleep = habit ? isHibernating(habit) : false;
  const affinities = getAffinities(attribute);
  const validSecondary = resolveSecondary(attribute, secondary);
  const [isDaily, setIsDaily] = useState(habit ? habit.frequency.type === 'daily' : true);
  const [days, setDays] = useState<number[]>(
    habit && habit.frequency.type === 'weekly' ? habit.frequency.days : [1, 2, 3, 4, 5],
  );
  const [graceDays, setGraceDays] = useState(habit?.graceDays ?? 2);
  const [effort, setEffort] = useState<EffortTier>(habit?.effort ?? inferEffort(habit?.xpReward ?? 20));

  const toggleDay = (d: number) => setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));

  const canSave = name.trim().length > 0 && (isDaily || days.length > 0);

  const handleSave = () => {
    if (!canSave) return;
    const frequency: Frequency = isDaily ? { type: 'daily' } : { type: 'weekly', days };
    if (habit) {
      updateHabit(habit.id, { name, attribute, secondary: validSecondary, frequency, graceDays, effort });
    } else {
      addHabit({ name, attribute, secondary: validSecondary, frequency, graceDays, effort });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
      <div className="max-h-[92dvh] w-full max-w-[560px] overflow-y-auto rounded-t-3xl border-t border-gold-500/40 bg-ink-900 p-5 pb-8">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />
        <h2 className="font-display text-lg font-bold text-gold-300">{habit ? 'Edit Quest' : 'New Quest'}</h2>

        <label className="mt-5 block text-xs uppercase tracking-wide text-white/50">Quest name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Morning run"
          maxLength={60}
          className="mt-1.5 w-full rounded-lg border border-white/15 bg-ink-800 px-3 py-2.5 text-white outline-none focus:border-gold-500/70"
        />

        <label className="mt-5 block text-xs uppercase tracking-wide text-white/50">Trains attribute</label>
        <div className="mt-1.5 grid grid-cols-3 gap-2">
          {ATTRIBUTE_KEYS.map((key) => {
            const info = ATTRIBUTE_INFO[key];
            const selected = attribute === key;
            return (
              <button
                key={key}
                onClick={() => setAttribute(key)}
                className={`rounded-lg border px-2 py-2 text-xs font-medium transition-colors ${
                  selected ? 'border-gold-500 bg-gold-500/15 text-gold-300' : 'border-white/15 text-white/60'
                }`}
              >
                {info.label}
              </button>
            );
          })}
        </div>

        <label className="mt-5 block text-xs uppercase tracking-wide text-white/50">
          Also builds <span className="text-white/30">(optional)</span>
        </label>
        <p className="mt-1 text-[11px] text-white/35">
          A quest can serve two things. The second earns {Math.round(SECONDARY_SHARE * 100)}% of the XP, builds no
          streak of its own, and never decays. Only attributes that plausibly follow from{' '}
          {ATTRIBUTE_INFO[attribute].label} are offered.
        </p>
        <div className="mt-1.5 flex gap-2">
          <button
            onClick={() => setSecondary(null)}
            className={`flex-1 rounded-lg border px-2 py-2 text-xs font-medium transition-colors ${
              validSecondary === null
                ? 'border-gold-500 bg-gold-500/15 text-gold-300'
                : 'border-white/15 text-white/60'
            }`}
          >
            Nothing
          </button>
          {affinities.map((key) => {
            const info = ATTRIBUTE_INFO[key];
            const selected = validSecondary === key;
            return (
              <button
                key={key}
                onClick={() => setSecondary(key)}
                className={`flex-1 rounded-lg border px-2 py-2 text-xs font-medium transition-colors ${
                  selected ? 'border-gold-500 bg-gold-500/15 text-gold-300' : 'border-white/15 text-white/60'
                }`}
              >
                {info.label}
              </button>
            );
          })}
        </div>

        <label className="mt-5 block text-xs uppercase tracking-wide text-white/50">Schedule</label>
        <div className="mt-1.5 flex gap-2">
          <button
            onClick={() => setIsDaily(true)}
            className={`flex-1 rounded-lg border px-3 py-2 text-sm ${
              isDaily ? 'border-gold-500 bg-gold-500/15 text-gold-300' : 'border-white/15 text-white/60'
            }`}
          >
            Every day
          </button>
          <button
            onClick={() => setIsDaily(false)}
            className={`flex-1 rounded-lg border px-3 py-2 text-sm ${
              !isDaily ? 'border-gold-500 bg-gold-500/15 text-gold-300' : 'border-white/15 text-white/60'
            }`}
          >
            Specific days
          </button>
        </div>
        {!isDaily && (
          <div className="mt-2 flex justify-between gap-1">
            {[0, 1, 2, 3, 4, 5, 6].map((d) => (
              <button
                key={d}
                onClick={() => toggleDay(d)}
                className={`h-9 w-9 rounded-full border text-xs ${
                  days.includes(d) ? 'border-gold-500 bg-gold-500/15 text-gold-300' : 'border-white/15 text-white/50'
                }`}
              >
                {weekdayLabel(d)[0]}
              </button>
            ))}
          </div>
        )}

        <label className="mt-5 block text-xs uppercase tracking-wide text-white/50">
          Grace period before skills decay: {graceDays} day{graceDays === 1 ? '' : 's'}
        </label>
        <input
          type="range"
          min={0}
          max={7}
          value={graceDays}
          onChange={(e) => setGraceDays(Number(e.target.value))}
          className="mt-2 w-full accent-[var(--color-gold-500)]"
        />
        <p className="mt-1 text-[11px] text-white/40">
          Miss this quest for more than {graceDays} scheduled day{graceDays === 1 ? '' : 's'} in a row and its
          attribute starts losing XP each day until you complete it again.
        </p>

        <label className="mt-5 block text-xs uppercase tracking-wide text-white/50">How much work is it?</label>
        <p className="mt-0.5 text-[11px] text-white/30">
          Roughly how long it takes. Nothing is timed — it just sets what the quest is worth.
        </p>
        <div className="mt-2 flex flex-col gap-2">
          {EFFORT_ORDER.map((key) => {
            const info = EFFORT_TIERS[key];
            const selected = effort === key;
            return (
              <button
                key={key}
                onClick={() => setEffort(key)}
                className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${
                  selected ? 'border-gold-500 bg-gold-500/15' : 'border-white/15'
                }`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className={`font-display font-semibold ${selected ? 'text-gold-300' : 'text-white/70'}`}>
                    {info.label}
                  </span>
                  <span className={`shrink-0 text-xs ${selected ? 'text-gold-300' : 'text-white/45'}`}>
                    {info.xp} XP · 🪙 {getEffortGold(key)}
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] text-white/40">{info.time}</p>
                <p className="mt-0.5 text-[11px] text-white/30">{info.hint}</p>
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[11px] text-white/30">
          Harder quests are worth far more XP, but only a little more gold — so rating a quest high moves your
          character faster without making real rewards cheaper.
        </p>

        <div className="mt-7 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-white/15 py-2.5 text-sm font-medium text-white/70"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="flex-1 rounded-lg bg-gold-500 py-2.5 text-sm font-semibold text-ink-950 disabled:opacity-40"
          >
            {habit ? 'Save changes' : 'Create quest'}
          </button>
        </div>

        {habit && !habit.archived && (
          <div className="mt-3 rounded-xl border border-white/10 bg-ink-800/40 p-3">
            {asleep ? (
              <>
                <p className="text-[12px] text-white/60">
                  😴 Asleep for another {daysUntilWake(habit)} day
                  {daysUntilWake(habit) === 1 ? '' : 's'}. Its streak and bonus are waiting for it.
                </p>
                <button
                  onClick={() => {
                    wakeHabit(habit.id);
                    onClose();
                  }}
                  className="mt-2 w-full rounded-lg border border-gold-500/50 py-2 text-xs text-gold-300"
                >
                  Wake it now
                </button>
              </>
            ) : sleepOpen ? (
              <>
                <p className="text-[12px] text-white/60">How long should it sleep?</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {HIBERNATE_OPTIONS.map((o) => (
                    <button
                      key={o.days}
                      onClick={() => {
                        hibernateHabit(habit.id, o.days);
                        onClose();
                      }}
                      className="rounded-lg border border-white/15 py-2 text-xs text-white/70"
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setSleepOpen(false)}
                  className="mt-2 w-full py-1 text-[11px] text-white/35"
                >
                  Never mind
                </button>
              </>
            ) : (
              <>
                <h3 className="font-display text-xs font-semibold text-white/60">Out of season?</h3>
                <p className="mt-1 text-[11px] leading-relaxed text-white/40">
                  Put it to sleep instead of archiving. No decay, nothing due, and your streak is exactly where you
                  left it when it wakes.
                </p>
                <button
                  onClick={() => setSleepOpen(true)}
                  className="mt-2 w-full rounded-lg border border-white/15 py-2 text-xs text-white/60"
                >
                  😴 Hibernate this quest
                </button>
              </>
            )}
          </div>
        )}

        {habit && (
          <div className="mt-3 flex gap-2">
            {!habit.archived && (
              <button
                onClick={() => {
                  archiveHabit(habit.id);
                  onClose();
                }}
                className="flex-1 rounded-lg border border-white/10 py-2 text-xs text-white/50"
              >
                Archive quest
              </button>
            )}
            <button
              onClick={() => {
                // Deleting also drops every completion logged against this
                // quest, which erases it from the Chronicle and takes its
                // contribution to this week's boss with it. That's a bigger
                // deal than "and its history" was letting on.
                const logged = completions.filter((c) => c.habitId === habit.id).length;
                const detail = logged
                  ? `This erases ${logged} logged completion${logged === 1 ? '' : 's'} from your Chronicle and this week's boss progress.`
                  : 'It has no logged completions yet.';
                if (
                  confirm(
                    `Delete "${habit.name}"?\n\n${detail}\n\nYour character keeps the XP and gold it already earned. To stop tracking a quest but keep its history, use Archive instead.\n\nThis cannot be undone.`,
                  )
                ) {
                  deleteHabit(habit.id);
                  onClose();
                }
              }}
              className="flex-1 rounded-lg border border-blood-500/40 py-2 text-xs text-blood-400"
            >
              Delete quest
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

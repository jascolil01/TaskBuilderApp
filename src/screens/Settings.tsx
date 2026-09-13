import { useMemo, useRef, useState } from 'react';
import { useStore } from '../store';
import { hapticsSupported } from '../lib/haptics';
import { getBackupHealth } from '../lib/storage';
import { todayStr } from '../lib/date';
import {
  daysInclusive,
  getEffectiveEnd,
  MAX_VACATION_DAYS,
  MAX_VACATIONS_PER_YEAR,
  vacationsRemainingThisYear,
} from '../lib/vacation';

export function Settings({ onClose }: { onClose: () => void }) {
  const haptics = useStore((s) => s.settings.haptics ?? true);
  const createdAt = useStore((s) => s.character.createdAt);
  const lastBackupDate = useStore((s) => s.settings.lastBackupDate ?? null);
  const backup = getBackupHealth(lastBackupDate, createdAt);
  const characterName = useStore((s) => s.character.name);
  const resetAll = useStore((s) => s.resetAll);
  const settings = useStore((s) => s.settings);
  const setReminderSettings = useStore((s) => s.setReminderSettings);
  const exportData = useStore((s) => s.exportData);
  const importData = useStore((s) => s.importData);
  const vacations = useStore((s) => s.vacations);
  const scheduleVacation = useStore((s) => s.scheduleVacation);
  const cancelVacation = useStore((s) => s.cancelVacation);
  const [vacationStart, setVacationStart] = useState('');
  const [vacationEnd, setVacationEnd] = useState('');
  const [vacationError, setVacationError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [importMessage, setImportMessage] = useState<{ text: string; error: boolean } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const notificationsSupported = typeof Notification !== 'undefined';

  const handleToggleReminders = async () => {
    if (settings.enabled) {
      setReminderSettings({ enabled: false });
      return;
    }
    if (notificationsSupported && Notification.permission !== 'granted') {
      const result = await Notification.requestPermission();
      if (result !== 'granted') {
        setPermissionDenied(true);
        // Still enable — the in-app "quests left today" banner keeps working
        // even without OS notification permission.
      } else {
        setPermissionDenied(false);
      }
    }
    setReminderSettings({ enabled: true });
  };

  const handleExport = () => {
    const json = exportData();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `questlog-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = async (file: File) => {
    const confirmed = confirm(
      'Import this backup? It will replace your current character, quests, gold, and history. This cannot be undone.',
    );
    if (!confirmed) {
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    const text = await file.text();
    const result = importData(text);
    setImportMessage({ text: result.ok ? 'Backup imported successfully.' : (result.error ?? 'Import failed.'), error: !result.ok });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const today = todayStr();
  const remaining = vacationsRemainingThisYear(vacations, today);
  // Past trips stay in the record for the yearly count, but only ones that
  // haven't finished are worth showing as plans.
  const shownVacations = useMemo(
    () =>
      [...vacations]
        .filter((v) => getEffectiveEnd(v) >= today)
        .sort((a, b) => a.startDate.localeCompare(b.startDate)),
    [vacations, today],
  );

  const handleScheduleVacation = () => {
    const result = scheduleVacation(vacationStart, vacationEnd);
    if (!result.ok) {
      setVacationError(result.error ?? 'That vacation could not be scheduled.');
      return;
    }
    setVacationError(null);
    setVacationStart('');
    setVacationEnd('');
  };

  const handleCancelVacation = (id: string) => {
    if (!confirm('Cancel this vacation? It will free up one of your two for the year.')) return;
    cancelVacation(id);
  };

  const handleReset = () => {
    const confirmed = confirm(
      `Reset everything? This permanently deletes ${characterName || 'your character'}, all attributes, gold, quests, quest history, and rewards. This cannot be undone.`,
    );
    if (!confirmed) return;
    resetAll();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
      <div className="max-h-[92dvh] w-full max-w-[560px] overflow-y-auto rounded-t-3xl border-t border-gold-500/40 bg-ink-900 p-5 pb-8">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />
        <h2 className="font-display text-lg font-bold text-gold-300">Settings</h2>

        <div className="mt-6 rounded-xl border border-white/10 bg-ink-800/50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display text-sm font-semibold text-gold-300">Daily reminder</h3>
              <p className="mt-0.5 text-xs text-white/40">Best-effort — only fires while the app has been opened recently</p>
            </div>
            <button
              onClick={handleToggleReminders}
              role="switch"
              aria-checked={settings.enabled}
              className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
                settings.enabled ? 'bg-gold-500' : 'bg-white/15'
              }`}
            >
              <span
                className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-transform ${
                  settings.enabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {settings.enabled && (
            <div className="mt-3">
              <label className="block text-xs uppercase tracking-wide text-white/50">Remind me at</label>
              <input
                type="time"
                value={settings.time}
                onChange={(e) => setReminderSettings({ time: e.target.value })}
                className="mt-1.5 w-full rounded-lg border border-white/15 bg-ink-900 px-3 py-2 text-white outline-none focus:border-gold-500/70"
              />
              {permissionDenied && (
                <p className="mt-2 text-xs text-blood-400">
                  Notification permission was denied — you'll still see the "quests left today" banner in the app,
                  but won't get an OS notification. You can allow notifications for this site in your browser
                  settings.
                </p>
              )}
            </div>
          )}
        </div>

        {hapticsSupported() && (
          <div className="mt-4 rounded-xl border border-white/10 bg-ink-800/50 p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display text-sm font-semibold text-gold-300">Vibration</h3>
                <p className="mt-0.5 text-xs text-white/40">A short buzz when a quest lands, a level turns, or a boss falls</p>
              </div>
              <button
                onClick={() => setReminderSettings({ haptics: !haptics })}
                role="switch"
                aria-checked={haptics}
                aria-label="Vibration"
                className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
                  haptics ? 'bg-gold-500' : 'bg-white/15'
                }`}
              >
                <span
                  className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${
                    haptics ? 'left-6' : 'left-1'
                  }`}
                />
              </button>
            </div>
          </div>
        )}

        <div className="mt-4 rounded-xl border border-white/10 bg-ink-800/50 p-4">
          <h3 className="font-display text-sm font-semibold text-gold-300">Backup</h3>
          <p className="mt-1 text-xs text-white/40">
            Your data lives only on this device. Export a backup file to keep somewhere safe or move to a new phone.
          </p>
          {backup.message && (
            <p className="mt-2 rounded-lg border border-gold-500/35 bg-gold-500/10 px-3 py-2 text-[11px] leading-relaxed text-gold-300/90">
              {backup.message}
            </p>
          )}
          <div className="mt-3 flex gap-2">
            <button
              onClick={handleExport}
              className="flex-1 rounded-lg border border-gold-500/50 bg-gold-500/10 py-2 text-sm font-medium text-gold-300 active:scale-95"
            >
              Export data
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 rounded-lg border border-white/15 py-2 text-sm font-medium text-white/70 active:scale-95"
            >
              Import data
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImportFile(file);
              }}
            />
          </div>
          {importMessage && (
            <p className={`mt-2 text-xs ${importMessage.error ? 'text-blood-400' : 'text-verdant-400'}`}>
              {importMessage.text}
            </p>
          )}
        </div>

        <div className="mt-4 rounded-xl border border-white/10 bg-ink-800/50 p-4">
          <h3 className="font-display text-sm font-semibold text-gold-300">Vacation</h3>
          <p className="mt-1 text-xs text-white/40">
            Freeze your streaks while you're away — no decay, no boss, nothing lost. Up to{' '}
            {MAX_VACATIONS_PER_YEAR} per year, {MAX_VACATION_DAYS} days each. Quests still pay XP if you feel like
            doing one.
          </p>
          <p className="mt-2 text-xs text-white/55">
            {remaining} of {MAX_VACATIONS_PER_YEAR} left for {today.slice(0, 4)}
          </p>

          {shownVacations.length > 0 && (
            <ul className="mt-3 flex flex-col gap-2">
              {shownVacations.map((v) => {
                const started = v.startDate <= today;
                return (
                  <li
                    key={v.id}
                    className="flex items-center gap-2 rounded-lg border border-white/10 bg-ink-900/50 px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-white/75">
                        {v.startDate} → {getEffectiveEnd(v)}
                      </p>
                      <p className="text-[11px] text-white/35">
                        {daysInclusive(v.startDate, getEffectiveEnd(v))} days ·{' '}
                        {started ? 'in progress' : 'scheduled'}
                      </p>
                    </div>
                    {!started && (
                      <button
                        onClick={() => handleCancelVacation(v.id)}
                        className="shrink-0 rounded-full border border-white/15 px-3 py-1 text-xs text-white/60 active:scale-95"
                      >
                        Cancel
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {remaining > 0 ? (
            <div className="mt-3">
              <div className="flex gap-2">
                <label className="min-w-0 flex-1">
                  <span className="block text-xs uppercase tracking-wide text-white/50">First day</span>
                  <input
                    type="date"
                    value={vacationStart}
                    min={today}
                    onChange={(e) => {
                      setVacationStart(e.target.value);
                      setVacationError(null);
                    }}
                    className="mt-1.5 w-full rounded-lg border border-white/15 bg-ink-900 px-3 py-2 text-white outline-none focus:border-gold-500/70"
                  />
                </label>
                <label className="min-w-0 flex-1">
                  <span className="block text-xs uppercase tracking-wide text-white/50">Last day</span>
                  <input
                    type="date"
                    value={vacationEnd}
                    min={vacationStart || today}
                    onChange={(e) => {
                      setVacationEnd(e.target.value);
                      setVacationError(null);
                    }}
                    className="mt-1.5 w-full rounded-lg border border-white/15 bg-ink-900 px-3 py-2 text-white outline-none focus:border-gold-500/70"
                  />
                </label>
              </div>
              {vacationStart && vacationEnd && vacationEnd >= vacationStart && (
                <p className="mt-2 text-[11px] text-white/40">
                  {daysInclusive(vacationStart, vacationEnd)} day
                  {daysInclusive(vacationStart, vacationEnd) === 1 ? '' : 's'} away
                </p>
              )}
              {vacationError && <p className="mt-2 text-xs text-blood-400">{vacationError}</p>}
              <button
                onClick={handleScheduleVacation}
                disabled={!vacationStart || !vacationEnd}
                className="mt-3 w-full rounded-lg border border-gold-500/50 bg-gold-500/10 py-2 text-sm font-medium text-gold-300 active:scale-95 disabled:opacity-40"
              >
                Schedule vacation
              </button>
            </div>
          ) : (
            <p className="mt-3 text-xs text-white/35">
              Both vacations for {today.slice(0, 4)} are used. Your allowance resets on Jan 1.
            </p>
          )}
        </div>

        <div className="mt-4 rounded-xl border border-blood-500/40 bg-blood-500/5 p-4">
          <h3 className="font-display text-sm font-semibold text-blood-400">Danger zone</h3>
          <p className="mt-1 text-sm text-white/50">
            Wipe your character, quests, gold, and history, and start over from a fresh, unnamed character. This
            cannot be undone.
          </p>
          <button
            onClick={handleReset}
            className="mt-3 w-full rounded-lg border border-blood-500/50 bg-blood-500/15 py-2.5 text-sm font-semibold text-blood-400 active:scale-95"
          >
            Reset everything
          </button>
        </div>

        <button
          onClick={onClose}
          className="mt-4 w-full rounded-lg border border-white/15 py-2.5 text-sm font-medium text-white/70"
        >
          Close
        </button>
      </div>
    </div>
  );
}

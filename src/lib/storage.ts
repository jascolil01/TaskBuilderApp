import { daysBetween, todayStr } from './date';

/**
 * Keeping the save alive, and knowing when it's at risk.
 *
 * Everything this app knows lives in localStorage on one device. That is the
 * whole privacy story and it is also the whole risk: there is no server copy
 * to fall back on.
 *
 * A home-screen web app is safer than it first appears — WebKit exempts
 * installed web apps from the seven-day cap that clears script-writable
 * storage for ordinary Safari tabs, and gives them their own isolated store.
 * But "exempt from that rule" is not "permanent": storage can still be
 * evicted under disk pressure, and someone running this in a browser tab
 * rather than installed gets no exemption at all.
 *
 * So: ask the browser to keep it, and if it won't, say so and push harder on
 * backups.
 */

export type PersistState = 'persisted' | 'refused' | 'unsupported';

/**
 * Asks the browser to make storage persistent. Chrome grants this silently
 * for installed apps; Safari does not implement it; Firefox may prompt.
 *
 * Deliberately fire-and-forget — the answer changes how loudly we nag about
 * backups, nothing more, and it must never delay or block startup.
 */
export async function requestPersistentStorage(): Promise<PersistState> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) return 'unsupported';
  try {
    if (await navigator.storage.persisted?.()) return 'persisted';
    return (await navigator.storage.persist()) ? 'persisted' : 'refused';
  } catch {
    return 'unsupported';
  }
}

/** True when the app is running installed rather than in a browser tab. */
export function isInstalled(): boolean {
  if (typeof window === 'undefined') return false;
  const standalone = (navigator as { standalone?: boolean }).standalone === true;
  return standalone || window.matchMedia?.('(display-mode: standalone)').matches === true;
}

/**
 * How stale a backup is allowed to get before it's worth mentioning. Long
 * enough that it isn't nagging, short enough that a loss doesn't cost a
 * season's progress.
 */
export const BACKUP_STALE_DAYS = 60;

export interface BackupHealth {
  /** Days since the last export, or null if there has never been one. */
  age: number | null;
  stale: boolean;
  /** The line to show, or null when there's nothing worth saying. */
  message: string | null;
}

/**
 * Whether to prompt for a backup, and what to say.
 *
 * `accountAge` keeps this quiet for a brand-new character: telling someone to
 * back up four days of history is noise, and noise is how a warning stops
 * being read.
 */
export function getBackupHealth(
  lastBackupDate: string | null,
  accountCreatedAt: string,
  today = todayStr(),
): BackupHealth {
  const accountAge = daysBetween(accountCreatedAt.slice(0, 10), today);
  if (accountAge < BACKUP_STALE_DAYS) return { age: null, stale: false, message: null };

  if (!lastBackupDate) {
    return {
      age: null,
      stale: true,
      message: `You've never exported a backup. Everything here lives on this device only — ${accountAge} days of it now.`,
    };
  }

  const age = daysBetween(lastBackupDate, today);
  if (age < BACKUP_STALE_DAYS) return { age, stale: false, message: null };
  return {
    age,
    stale: true,
    message: `Your last backup was ${age} days ago. It only takes a moment and it's the only copy you have.`,
  };
}

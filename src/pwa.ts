import { registerSW } from 'virtual:pwa-register';

/**
 * Keeps an installed PWA on the latest deploy.
 *
 * The registration script vite-plugin-pwa injects by default only calls
 * `navigator.serviceWorker.register()` on `load`. That leaves two gaps that
 * together produce the "open, close, reopen to see changes" behaviour:
 *
 *  1. Nothing reloads the page when a new worker takes control, so the first
 *     launch after a deploy downloads the update in the background while the
 *     already-rendered old assets stay on screen. Only the *next* launch
 *     shows the new version.
 *  2. An installed app resumed from the background doesn't fire `load` at
 *     all, so it may never check for an update in the first place.
 *
 * This registers manually so both are handled: check on launch, on resume,
 * and hourly; reload as soon as the new worker is in control.
 */
export function setupPwaUpdates(): void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

  // Reloading out from under someone who is typing would lose what they'd
  // entered, so hold the update until they're not mid-edit.
  const isMidEdit = () => {
    const el = document.activeElement as HTMLElement | null;
    if (!el) return false;
    return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable;
  };

  // `controllerchange` fires once the freshly installed worker claims this
  // page. At that point the caches hold the new build, so a reload swaps the
  // user onto it. The flag guards against a reload loop.
  let reloading = false;
  const applyUpdate = () => {
    if (reloading) return;
    if (isMidEdit()) {
      // Try again when they finish, or the next time the app is resumed.
      document.addEventListener('visibilitychange', applyUpdate, { once: true });
      document.addEventListener('focusout', applyUpdate, { once: true });
      return;
    }
    reloading = true;
    window.location.reload();
  };
  navigator.serviceWorker.addEventListener('controllerchange', applyUpdate);

  registerSW({
    immediate: true,
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;

      const checkForUpdate = () => {
        if (document.visibilityState !== 'visible') return;
        // Network hiccups and offline launches are expected; a failed check
        // just means we try again on the next resume.
        registration.update().catch(() => {});
      };

      checkForUpdate();
      document.addEventListener('visibilitychange', checkForUpdate);
      window.addEventListener('focus', checkForUpdate);
      // Backstop for a session left open for a long stretch.
      setInterval(checkForUpdate, 60 * 60 * 1000);
    },
  });
}

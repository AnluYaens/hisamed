/**
 * Decide whether to show the iOS "add to home screen" install path.
 *
 * iOS Safari never fires `beforeinstallprompt`, so the only way to let an
 * iPhone/iPad user install the PWA is to show manual instructions. We treat a
 * device as needing that path when the user agent looks like iOS AND the app is
 * not already running as an installed standalone PWA (in which case there is
 * nothing left to install and the button stays hidden everywhere).
 *
 * Chromium browsers fall through this check (returns `false`) and use the
 * native `beforeinstallprompt` flow instead.
 */
export function isIosSafari(userAgent: string, isStandalone: boolean): boolean {
  if (isStandalone) return false;
  return /iphone|ipad|ipod/i.test(userAgent);
}

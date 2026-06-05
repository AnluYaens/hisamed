import { describe, expect, it } from 'vitest';
import { isIosSafari } from '../install';

// Real-ish user-agent strings for the two install paths the button branches on.
const IOS_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
const IPAD_UA =
  'Mozilla/5.0 (iPad; CPU OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1';
const CHROME_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

describe('isIosSafari', () => {
  it('takes the iOS modal path for an iPhone that is not yet installed', () => {
    // navigator.userAgent looks like iOS and the app is not standalone →
    // the button shows the manual "add to home screen" instructions modal.
    expect(isIosSafari(IOS_UA, false)).toBe(true);
  });

  it('also matches iPad and iPod user agents', () => {
    expect(isIosSafari(IPAD_UA, false)).toBe(true);
    expect(isIosSafari('something iPod something', false)).toBe(true);
  });

  it('takes the beforeinstallprompt path for Chrome/Edge', () => {
    // Not iOS → returns false, so the button falls through to the native
    // `beforeinstallprompt` flow instead of the iOS modal.
    expect(isIosSafari(CHROME_UA, false)).toBe(false);
  });

  it('stays hidden once installed (standalone), even on iOS', () => {
    expect(isIosSafari(IOS_UA, true)).toBe(false);
  });
});

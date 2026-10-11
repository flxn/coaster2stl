/**
 * Google AdSense helpers.
 *
 * adsbygoogle.js is injected by vite/site-plugin.ts when `ads.client` is set in src/site.config.ts;
 * its onload / onerror handlers set window.__adsLoaded / window.__adsBlocked so we can tell
 * whether ads can be shown at all.
 */
import siteConfig, { type AdUnit } from '@/site.config';

declare global {
  interface Window {
    __adsLoaded?: boolean;
    __adsBlocked?: boolean;
    adsbygoogle?: unknown[] & { loaded?: boolean };
  }
}

export type AdName = keyof typeof siteConfig.ads.units;

/** reported by <AdSlot>; 'unfilled' also covers units that are not configured */
export type AdState = 'loading' | 'filled' | 'unfilled' | 'blocked';

// how long we wait for adsbygoogle.js before treating it as blocked
const LOAD_TIMEOUT = 10000;

export const adClient = siteConfig.ads.client;

/** The configured ad unit, or null when ads are off or the unit has no slot id. */
export const getAdUnit = (name: AdName): AdUnit | null => {
  const unit = siteConfig.ads.units[name];
  return adClient && unit?.slot ? unit : null;
};

/**
 * Test ads (not billed or counted) on localhost and with ?adtest in the URL,
 * so layouts can be checked without generating real impressions.
 */
export const isAdTestMode = (): boolean => {
  const { hostname, search } = window.location;
  return hostname === 'localhost' || hostname === '127.0.0.1' || new URLSearchParams(search).has('adtest');
};

let readyPromise: Promise<'loaded' | 'blocked'> | null = null;

/** Resolves with 'loaded' once adsbygoogle.js is available, or 'blocked' if it failed to load. */
export const whenAdsReady = (): Promise<'loaded' | 'blocked'> => {
  if (!readyPromise) {
    readyPromise = new Promise((resolve) => {
      const started = Date.now();
      const check = () => {
        if (window.__adsLoaded || window.adsbygoogle?.loaded) {
          resolve('loaded');
        } else if (window.__adsBlocked || Date.now() - started > LOAD_TIMEOUT) {
          resolve('blocked');
        } else {
          window.setTimeout(check, 200);
        }
      };
      check();
    });
  }
  return readyPromise;
};

/** Asks AdSense to fill the next unfilled ad unit on the page. */
export const requestAd = (): boolean => {
  try {
    window.adsbygoogle = window.adsbygoogle || [];
    window.adsbygoogle.push({});
    return true;
  } catch (error) {
    console.warn('AdSense request failed:', error);
    return false;
  }
};

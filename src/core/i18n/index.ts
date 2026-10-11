import { createI18n } from 'vue-i18n';
import siteConfig from '@/site.config';
import {
  defaultLocale, isLocale, localePath, locales, messages, type Locale,
} from './messages';

export { locales, localePath, type Locale };

const LOCALE_KEY = 'locale';

/**
 * Every language has its own URL (/ and /de/), so search engines can index each one.
 * A language in the path always wins; at the root, a remembered choice or the browser language is used.
 */
const detectLocale = (): Locale => {
  const fromPath = window.location.pathname.split('/')[1];
  if (isLocale(fromPath) && fromPath !== defaultLocale) {
    return fromPath;
  }
  try {
    const stored = window.localStorage.getItem(LOCALE_KEY);
    if (isLocale(stored)) {
      return stored;
    }
  } catch {
    // storage unavailable
  }
  return navigator.languages.map((language) => language.slice(0, 2).toLowerCase()).find(isLocale) ?? defaultLocale;
};

/** The path after the language prefix, e.g. '/d/abc' for '/de/d/abc' ('/' for the start pages). */
const subPath = () => {
  const [, first, ...rest] = window.location.pathname.split('/');
  return isLocale(first) && first !== defaultLocale ? `/${rest.join('/')}` : window.location.pathname;
};

/**
 * Keeps URL, document language, title and canonical link in line with the shown language.
 * Deeper pages (e.g. shared designs at /d/<id>) keep their path and their own title from the server.
 */
const applyLocaleToDocument = (locale: Locale) => {
  const rest = subPath();
  const isStartPage = rest === '/' || rest === '';
  const path = isStartPage ? localePath(locale) : `${localePath(locale).replace(/\/$/, '')}${rest}`;
  if (window.location.pathname !== path) {
    window.history.replaceState(window.history.state, '', `${path}${window.location.search}${window.location.hash}`);
  }
  document.documentElement.setAttribute('lang', locale);
  if (!isStartPage) {
    return;
  }
  const { seo } = messages[locale];
  document.title = seo.title;
  document.querySelector('meta[name="description"]')?.setAttribute('content', seo.description);
  document.querySelector('link[rel="canonical"]')?.setAttribute('href', new URL(path, siteConfig.url).href);
};

const initialLocale = detectLocale();
applyLocaleToDocument(initialLocale);

export const i18n = createI18n({
  legacy: false,
  locale: initialLocale,
  fallbackLocale: defaultLocale,
  messages,
});

export const setLocale = (locale: Locale) => {
  i18n.global.locale.value = locale;
  applyLocaleToDocument(locale);
  try {
    window.localStorage.setItem(LOCALE_KEY, locale);
  } catch {
    // storage unavailable: the language applies for this session
  }
};

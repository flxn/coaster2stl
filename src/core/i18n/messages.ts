/**
 * All texts per language: the shared core texts merged with the tool's texts.
 * Plain data without Vue, so the build (vite/site-plugin.ts) can use it for SEO tags and static content.
 */
import toolDe from '../../tool/i18n/de.ts';
import toolEn from '../../tool/i18n/en.ts';
import coreDe from './de.ts';
import coreEn from './en.ts';

const mergeMessages = <A extends object, B extends object>(core: A, tool: B): A & B => {
  const result: Record<string, unknown> = { ...(core as Record<string, unknown>) };
  Object.entries(tool).forEach(([key, value]) => {
    const existing = result[key];
    result[key] = existing && typeof existing === 'object' && !Array.isArray(existing) && typeof value === 'object'
      ? mergeMessages(existing, value)
      : value;
  });
  return result as A & B;
};

export const messages = {
  en: mergeMessages(coreEn, toolEn),
  de: mergeMessages(coreDe, toolDe),
};

export type Locale = keyof typeof messages;
export type Messages = (typeof messages)[Locale];

/** served at the site root; every other language lives at /<locale>/ */
export const defaultLocale: Locale = 'en';
export const locales = Object.keys(messages) as Locale[];

export const isLocale = (value: unknown): value is Locale => typeof value === 'string' && value in messages;

/** URL path of a language version, e.g. '/' or '/de/' */
export const localePath = (locale: Locale) => (locale === defaultLocale ? '/' : `/${locale}/`);

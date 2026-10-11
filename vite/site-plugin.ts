import type { Plugin } from 'vite';
import type { SiteConfig } from '../src/site.config.ts';
import type { FaqEntry } from '../src/core/tool.ts';
import {
  defaultLocale, localePath, locales, messages, type Locale, type Messages,
} from '../src/core/i18n/messages.ts';

/**
 * Search engine basis, generated from src/site.config.ts and the translated texts:
 * - one HTML page per language (/ and /<locale>/) with its own title, description, canonical link,
 *   hreflang alternates, OpenGraph / Twitter tags and JSON-LD (WebApplication, FAQPage, BreadcrumbList)
 * - static content inside #app (heading, features, guide, FAQ, language links) for crawlers and
 *   link previews that do not run JavaScript; the app replaces it when it starts
 * - robots.txt, sitemap.xml with language alternates, site.webmanifest
 */

const IMAGE_SIZE = { width: 1200, height: 630 };
const OG_LOCALES: Record<string, string> = { en: 'en_US', de: 'de_DE' };

const escapeHtml = (value: string) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

/** a JSON-LD block that cannot end the surrounding script tag early */
const jsonLd = (data: unknown) => `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;

/** Looks up a dotted i18n key such as 'faq.qrAnswer'. */
const text = (texts: Messages, key: string): string => {
  const value = key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], texts);
  return typeof value === 'string' ? value : key;
};

const pageUrl = (site: SiteConfig, locale: Locale) => new URL(localePath(locale), site.url).href;

const headTags = (site: SiteConfig, faq: FaqEntry[], locale: Locale, version: string) => {
  const texts = messages[locale];
  const { seo } = texts;
  const url = pageUrl(site, locale);
  const meta = (attribute: 'name' | 'property', key: string, content: string) => (
    `<meta ${attribute}="${key}" content="${escapeHtml(content)}">`
  );
  const tags = [
    `<title>${escapeHtml(seo.title)}</title>`,
    meta('name', 'description', seo.description),
    meta('name', 'author', site.author.name),
    meta('name', 'robots', 'index, follow, max-image-preview:large'),
    `<link rel="canonical" href="${url}">`,
    ...locales.map((alternate) => `<link rel="alternate" hreflang="${alternate}" href="${pageUrl(site, alternate)}">`),
    `<link rel="alternate" hreflang="x-default" href="${pageUrl(site, defaultLocale)}">`,
    meta('property', 'og:type', 'website'),
    meta('property', 'og:site_name', site.name),
    meta('property', 'og:url', url),
    meta('property', 'og:title', seo.title),
    meta('property', 'og:description', seo.description),
    meta('property', 'og:image', site.image),
    meta('property', 'og:image:width', String(IMAGE_SIZE.width)),
    meta('property', 'og:image:height', String(IMAGE_SIZE.height)),
    meta('property', 'og:image:alt', seo.imageAlt),
    meta('property', 'og:locale', OG_LOCALES[locale] ?? locale),
    ...locales.filter((alternate) => alternate !== locale)
      .map((alternate) => meta('property', 'og:locale:alternate', OG_LOCALES[alternate] ?? alternate)),
    meta('name', 'twitter:card', 'summary_large_image'),
    meta('name', 'twitter:title', seo.title),
    meta('name', 'twitter:description', seo.description),
    meta('name', 'twitter:image', site.image),
    meta('name', 'twitter:image:alt', seo.imageAlt),
  ];
  if (site.author.twitter) {
    tags.push(meta('name', 'twitter:site', site.author.twitter), meta('name', 'twitter:creator', site.author.twitter));
  }

  const directory = site.links.directory;
  const graph: Record<string, unknown>[] = [
    {
      '@type': 'WebApplication',
      '@id': `${url}#app`,
      name: texts.title,
      alternateName: site.name,
      description: seo.description,
      url,
      image: site.image,
      screenshot: site.image,
      inLanguage: locale,
      applicationCategory: 'DesignApplication',
      operatingSystem: 'Any',
      browserRequirements: 'Requires JavaScript and WebGL',
      isAccessibleForFree: true,
      softwareVersion: version,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      featureList: seo.features,
      author: { '@type': 'Person', name: site.author.name, url: site.author.url },
      ...(directory ? { isPartOf: { '@id': `${directory.replace(/\/$/, '')}/#website` } } : {}),
    },
    {
      '@type': 'FAQPage',
      '@id': `${url}#faq`,
      inLanguage: locale,
      mainEntity: faq.map((entry) => ({
        '@type': 'Question',
        name: text(texts, entry.question),
        acceptedAnswer: { '@type': 'Answer', text: text(texts, entry.answer) },
      })),
    },
  ];
  if (directory) {
    const host = new URL(directory).hostname;
    graph.push(
      {
        '@type': 'WebSite', '@id': `${directory.replace(/\/$/, '')}/#website`, name: host, url: directory,
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem', position: 1, name: host, item: directory,
          },
          {
            '@type': 'ListItem', position: 2, name: texts.title, item: url,
          },
        ],
      },
    );
  }
  tags.push(jsonLd({ '@context': 'https://schema.org', '@graph': graph }));

  if (site.analytics.umamiWebsiteId) {
    tags.push(`<script defer src="${site.analytics.umamiScript}" data-website-id="${site.analytics.umamiWebsiteId}"></script>`);
  }
  if (site.ads.client) {
    // the flags tell the app whether ads can load at all (see src/core/ads.ts)
    tags.push(`<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${site.ads.client}" crossorigin="anonymous" onload="window.__adsLoaded = true" onerror="window.__adsBlocked = true"></script>`);
  }
  return tags.join('\n    ');
};

/** The page content as plain HTML, for crawlers and previews without JavaScript. */
const bodyContent = (site: SiteConfig, faq: FaqEntry[], locale: Locale) => {
  const texts = messages[locale];
  const list = (items: string[], tag: 'ul' | 'ol') => `<${tag}>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</${tag}>`;
  const links = [
    ...(site.links.directory ? [`<a href="${site.links.directory}">${escapeHtml(new URL(site.links.directory).hostname)}</a>`] : []),
    ...site.relatedTools.map((tool) => `<a href="${tool.url}">${escapeHtml(tool.name)}</a>`),
  ];
  return [
    '<div class="seo-fallback">',
    `<h1>${escapeHtml(texts.title)}</h1>`,
    `<p>${escapeHtml(texts.subtitle)}</p>`,
    list(texts.seo.features, 'ul'),
    `<h2>${escapeHtml(texts.printGuide.title)}</h2>`,
    `<p>${escapeHtml(texts.printGuide.intro)}</p>`,
    list(texts.printGuide.steps, 'ol'),
    `<h2>${escapeHtml(texts.faqTitle)}</h2>`,
    `<dl>${faq.map((entry) => `<dt>${escapeHtml(text(texts, entry.question))}</dt><dd>${escapeHtml(text(texts, entry.answer))}</dd>`).join('')}</dl>`,
    `<p>${locales.map((alternate) => `<a href="${localePath(alternate)}" hreflang="${alternate}">${escapeHtml(messages[alternate].languageLocalName)}</a>`).join(' · ')}</p>`,
    links.length ? `<p>${links.join(' · ')}</p>` : '',
    '</div>',
  ].join('');
};

const HEAD_MARKER = /<!--seo-head-->[\s\S]*?<!--\/seo-head-->/;
const BODY_MARKER = /<!--seo-body-->[\s\S]*?<!--\/seo-body-->/;

const render = (html: string, site: SiteConfig, faq: FaqEntry[], locale: Locale, version: string) => html
  .replace(/<html lang="[^"]*">/, `<html lang="${locale}">`)
  .replace('%SITE_NAME%', escapeHtml(site.name))
  .replace(HEAD_MARKER, `<!--seo-head-->\n    ${headTags(site, faq, locale, version)}\n    <!--/seo-head-->`)
  .replace(BODY_MARKER, `<!--seo-body-->${bodyContent(site, faq, locale)}<!--/seo-body-->`);

export default function sitePlugin({ site, faq, version }: { site: SiteConfig; faq: FaqEntry[]; version: string }): Plugin {
  return {
    name: 'printer-tools-site',
    // after Vite has written the final index.html, so the language copies include the hashed assets
    enforce: 'post',
    transformIndexHtml(html, context) {
      // the dev server serves /de/ through the SPA fallback; build output starts with the default language
      const fromPath = context.originalUrl?.split('/')[1];
      const locale = locales.find((candidate) => candidate === fromPath) ?? defaultLocale;
      return render(html, site, faq, locale, version);
    },
    generateBundle(_options, bundle) {
      const index = bundle['index.html'];
      if (index?.type === 'asset') {
        locales.filter((locale) => locale !== defaultLocale).forEach((locale) => {
          this.emitFile({
            type: 'asset',
            fileName: `${locale}/index.html`,
            source: render(String(index.source), site, faq, locale, version),
          });
        });
      }

      const today = new Date().toISOString().slice(0, 10);
      const alternates = [
        ...locales.map((locale) => `    <xhtml:link rel="alternate" hreflang="${locale}" href="${pageUrl(site, locale)}"/>`),
        `    <xhtml:link rel="alternate" hreflang="x-default" href="${pageUrl(site, defaultLocale)}"/>`,
      ].join('\n');
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source: [
          '<?xml version="1.0" encoding="UTF-8"?>',
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
          ...locales.map((locale) => [
            '  <url>',
            `    <loc>${pageUrl(site, locale)}</loc>`,
            `    <lastmod>${today}</lastmod>`,
            alternates,
            '  </url>',
          ].join('\n')),
          '</urlset>',
          '',
        ].join('\n'),
      });
      this.emitFile({
        type: 'asset',
        fileName: 'robots.txt',
        source: `User-agent: *\nAllow: /\nDisallow: /admin\n\nSitemap: ${new URL('sitemap.xml', site.url).href}\n`,
      });
      this.emitFile({
        type: 'asset',
        fileName: 'site.webmanifest',
        source: JSON.stringify({
          name: messages[defaultLocale].title,
          short_name: site.name,
          description: messages[defaultLocale].seo.description,
          lang: defaultLocale,
          icons: [
            { src: '/icon-192.png?v=2', sizes: '192x192', type: 'image/png' },
            { src: '/icon-512.png?v=2', sizes: '512x512', type: 'image/png' },
            { src: '/favicon.png?v=2', sizes: '64x64', type: 'image/png' },
          ],
          theme_color: '#ffffff',
          background_color: '#ffffff',
          display: 'standalone',
          start_url: '/',
          scope: '/',
        }, null, 2),
      });
    },
  };
}

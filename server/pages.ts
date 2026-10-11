import type { Database } from './db.ts';

const escapeHtml = (value: string) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const setMeta = (html: string, attribute: 'name' | 'property', key: string, content: string) => {
  const tag = `<meta ${attribute}="${key}" content="${escapeHtml(content)}">`;
  const pattern = new RegExp(`<meta ${attribute}="${key.replace(/[.:]/g, '\\$&')}" content="[^"]*">`);
  return pattern.test(html) ? html.replace(pattern, tag) : html.replace('</head>', `${tag}\n</head>`);
};

/**
 * The app page for a shared design (/d/<id>): same app, but title, description, canonical link and
 * social preview image describe the design, so links look good in chats and search results.
 */
export const designPage = async (db: Database, template: string, id: string, requestUrl: string) => {
  const design = db.getDesign(id);
  if (!design || design.hidden) {
    return { status: 404 as const, html: template.replace('<head>', '<head>\n<meta name="robots" content="noindex">') };
  }
  const origin = process.env.PUBLIC_URL?.replace(/\/$/, '') ?? new URL(requestUrl).origin;
  const url = `${origin}${new URL(requestUrl).pathname}`;
  const image = `${origin}/api/designs/${design.id}/thumbnail`;
  const by = design.author ? ` by ${design.author}` : '';
  const title = `${design.title}${by} – 3D printable coaster`;
  const description = `A 3D printable coaster design${by}${design.tags ? ` (${design.tags.split(',').join(', ')})` : ''}. Open it in the free coaster generator, remix it and download the STL.`;

  let html = template
    .replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(title)}</title>`)
    .replace(/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${escapeHtml(url)}">`)
    // the language alternates describe the start page, not this design
    .replace(/<link rel="alternate" hreflang="[^"]*" href="[^"]*">\n?/g, '');
  html = setMeta(html, 'name', 'description', description);
  html = setMeta(html, 'property', 'og:title', title);
  html = setMeta(html, 'property', 'og:description', description);
  html = setMeta(html, 'property', 'og:url', url);
  html = setMeta(html, 'property', 'og:image', image);
  html = setMeta(html, 'property', 'og:image:width', '512');
  html = setMeta(html, 'property', 'og:image:height', '512');
  html = setMeta(html, 'property', 'og:image:alt', design.title);
  html = setMeta(html, 'name', 'twitter:card', 'summary');
  html = setMeta(html, 'name', 'twitter:title', title);
  html = setMeta(html, 'name', 'twitter:description', description);
  html = setMeta(html, 'name', 'twitter:image', image);
  return { status: 200 as const, html };
};

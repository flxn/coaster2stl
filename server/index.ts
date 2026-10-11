import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { compress } from 'hono/compress';
import { createApi } from './app.ts';
import { openDatabase } from './db.ts';
import { designPage } from './pages.ts';

/**
 * Production server: the API, the built site (dist/) and share pages for published designs.
 *
 * Environment:
 * - PORT (default 3000)
 * - DATA_DIR: where the SQLite database lives (default ./data; mount a volume there)
 * - ADMIN_TOKEN: enables the moderation page /admin and its API
 * - REPORT_THRESHOLD: reports after which a design is hidden (default 3)
 * - VOTER_SALT: salt for hashing anonymous browser ids
 * - PUBLIC_URL: absolute site URL for share pages (default from src/site.config.ts)
 */

const root = resolve(import.meta.dirname, '..');
const distDir = resolve(root, 'dist');
const port = Number(process.env.PORT) || 3000;
const db = openDatabase(resolve(process.env.DATA_DIR ?? resolve(root, 'data'), 'coasters.db'));

const app = new Hono();
app.use('*', compress());
app.use('*', async (c, next) => {
  await next();
  c.header('x-content-type-options', 'nosniff');
  c.header('referrer-policy', 'strict-origin-when-cross-origin');
});

app.route('/', createApi({
  db,
  adminToken: process.env.ADMIN_TOKEN,
  reportThreshold: Number(process.env.REPORT_THRESHOLD) || 3,
  salt: process.env.VOTER_SALT,
}));

// share pages: the app with the title, description and thumbnail of the design for link previews
const pageCache = new Map<string, string>();
const template = async (file: string) => {
  let html = pageCache.get(file);
  if (!html) {
    html = await readFile(resolve(distDir, file), 'utf8');
    pageCache.set(file, html);
  }
  return html;
};
app.get('/:locale{[a-z]{2}}/d/:id', async (c) => {
  const page = await designPage(db, await template(`${c.req.param('locale')}/index.html`).catch(() => template('index.html')), c.req.param('id'), c.req.url);
  return c.html(page.html, page.status, { 'cache-control': 'no-cache' });
});
app.get('/d/:id', async (c) => {
  const page = await designPage(db, await template('index.html'), c.req.param('id'), c.req.url);
  return c.html(page.html, page.status, { 'cache-control': 'no-cache' });
});

// the moderation page; its API calls are guarded by ADMIN_TOKEN (see server/app.ts)
app.get('/admin', async (c) => c.html(await template('admin.html'), 200, {
  'cache-control': 'no-cache',
  'x-robots-tag': 'noindex, nofollow',
  'x-frame-options': 'DENY',
}));
app.get('/admin.html', (c) => c.redirect('/admin', 301));

// language folders without the trailing slash: /de → /de/
app.get('/:locale{[a-z]{2}}', (c, next) => {
  const locale = c.req.param('locale');
  return existsSync(resolve(distDir, locale, 'index.html')) ? c.redirect(`/${locale}/`, 301) : next();
});

// hashed build output never changes
app.use('/assets/*', async (c, next) => {
  await next();
  if (c.res.status === 200) {
    c.header('cache-control', 'public, max-age=31536000, immutable');
  }
});
app.use('*', serveStatic({
  root: distDir,
  rewriteRequestPath: (path) => (path.endsWith('/') ? `${path}index.html` : path),
  onFound: (path, c) => {
    if (path.endsWith('.html') || path.endsWith('.webmanifest')) {
      c.header('cache-control', 'no-cache');
    }
  },
}));

// unknown paths are real 404s, so search engines never index duplicates of the start page
app.notFound(async (c) => c.html(await template('index.html'), 404));

serve({ fetch: app.fetch, port }, () => {
  console.log(`coaster2stl listening on http://localhost:${port}`);
  const token = process.env.ADMIN_TOKEN ?? '';
  if (!token) {
    console.log('ADMIN_TOKEN is not set: the moderation page /admin is disabled');
  } else if (token.length < 24) {
    console.warn('ADMIN_TOKEN is short: use at least 24 random characters (e.g. `openssl rand -base64 32`)');
  }
});

const shutdown = () => {
  db.db.close();
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

import { createHash, timingSafeEqual } from 'node:crypto';
import { Hono, type Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { hashSecret, type Database, type DesignSummary, type SortOrder } from './db.ts';
import { searchIcons, type IconSet } from './icons.ts';

/**
 * The JSON API under /api: the community gallery (publish, browse, search, like, report, remix)
 * and the icon library search. Used by the production server (server/index.ts) and mounted into the
 * Vite dev server (vite/api-plugin.ts).
 *
 * There are no accounts. Publishing returns a secret edit token that the browser keeps to delete the
 * design later; likes and reports are counted once per anonymous browser id.
 */

export interface ApiOptions {
  db: Database;
  /** Bearer token for the moderation endpoints; moderation is off when empty */
  adminToken?: string;
  /** designs with this many reports are hidden until a moderator looks at them */
  reportThreshold?: number;
  /** salt for hashing browser ids, so the database never stores them in clear */
  salt?: string;
}

const LIMITS = {
  title: 60,
  author: 40,
  tags: 8,
  tag: 24,
  options: 700_000,
  thumbnail: 450_000,
};

const THUMBNAIL_TYPES = ['image/webp', 'image/png', 'image/jpeg'];

/** wrong admin tokens per IP before it is locked out, and for how long */
const ADMIN_FAILURES = 10;
const ADMIN_LOCKOUT_MS = 15 * 60 * 1000;

/** Simple in-memory rate limiter: at most `max` hits per `windowMs` per key. */
const rateLimiter = (max: number, windowMs: number) => {
  const hits = new Map<string, number[]>();
  return (key: string) => {
    const now = Date.now();
    const recent = (hits.get(key) ?? []).filter((time) => now - time < windowMs);
    if (recent.length >= max) {
      hits.set(key, recent);
      return false;
    }
    recent.push(now);
    hits.set(key, recent);
    if (hits.size > 50_000) {
      hits.clear();
    }
    return true;
  };
};

const clientIp = (c: Context) => {
  const forwarded = c.req.header('x-forwarded-for')?.split(',')[0]?.trim();
  const incoming = (c.env as { incoming?: { socket?: { remoteAddress?: string } } } | undefined)?.incoming;
  return forwarded || c.req.header('x-real-ip') || incoming?.socket?.remoteAddress || 'unknown';
};

const cleanText = (value: unknown, max: number) => (typeof value === 'string'
  // no control characters, collapsed whitespace
  ? value.replace(/[\p{Cc}\p{Cf}]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, max)
  : '');

const cleanTags = (value: unknown): string[] => {
  const list = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [];
  return [...new Set(list
    .map((tag) => cleanText(tag, LIMITS.tag).toLowerCase().replace(/^#/, ''))
    .filter((tag) => /^[\p{L}\p{N}][\p{L}\p{N} -]*$/u.test(tag)))]
    .slice(0, LIMITS.tags);
};

const parseThumbnail = (value: unknown) => {
  const match = typeof value === 'string' ? /^data:(image\/[a-z]+);base64,([A-Za-z0-9+/=]+)$/.exec(value) : null;
  if (!match || !THUMBNAIL_TYPES.includes(match[1])) {
    return null;
  }
  const bytes = Buffer.from(match[2], 'base64');
  return bytes.length && bytes.length <= LIMITS.thumbnail ? { type: match[1], bytes: new Uint8Array(bytes) } : null;
};

const isDesignOptions = (value: unknown) => {
  const options = value as Record<string, unknown> | null;
  return !!options && typeof options === 'object' && !Array.isArray(options)
    && typeof options.coaster === 'object' && typeof options.colors === 'object';
};

const toPublic = (row: DesignSummary, liked = false) => ({
  id: row.id,
  title: row.title,
  author: row.author,
  tags: row.tags ? row.tags.split(',') : [],
  likes: row.likes,
  downloads: row.downloads,
  remixOf: row.remix_of,
  createdAt: row.created_at,
  thumbnail: `/api/designs/${row.id}/thumbnail`,
  liked,
});

export type PublicDesign = ReturnType<typeof toPublic>;

export const createApi = ({
  db, adminToken = '', reportThreshold = 3, salt = 'coaster2stl',
}: ApiOptions) => {
  const api = new Hono();
  const publishLimit = rateLimiter(8, 60 * 60 * 1000);
  const voteLimit = rateLimiter(240, 60 * 60 * 1000);
  const reportLimit = rateLimiter(20, 60 * 60 * 1000);
  const readLimit = rateLimiter(1200, 60 * 1000);

  /** anonymous, stable id of the browser (sent by the app), hashed before it touches the database */
  const voterId = (c: Context) => {
    const raw = c.req.header('x-client-id') ?? '';
    return /^[A-Za-z0-9-]{16,64}$/.test(raw) ? hashSecret(`${salt}:${raw}`) : null;
  };

  // compared as hashes in constant time, so the response time does not leak the token
  const adminHash = adminToken ? createHash('sha256').update(adminToken).digest() : null;
  const isAdmin = (c: Context) => {
    const token = /^Bearer (.+)$/.exec(c.req.header('authorization') ?? '')?.[1];
    return !!adminHash && !!token && timingSafeEqual(createHash('sha256').update(token).digest(), adminHash);
  };

  // guessing the token: after ADMIN_FAILURES wrong tries an IP is locked out for a while
  const failures = new Map<string, number[]>();
  const failedAdminLogins = (ip: string, record: boolean) => {
    const now = Date.now();
    const recent = (failures.get(ip) ?? []).filter((time) => now - time < ADMIN_LOCKOUT_MS);
    if (record) recent.push(now);
    failures.set(ip, recent);
    return recent.length;
  };

  api.use('*', async (c, next) => {
    if (!readLimit(clientIp(c))) {
      return c.json({ error: 'rate_limited' }, 429);
    }
    await next();
    if (!c.res.headers.has('cache-control')) {
      c.res.headers.set('cache-control', 'no-store');
    }
  });

  api.get('/health', (c) => c.json({ ok: true, ...db.stats() }));

  /* ---------- icons ---------- */

  api.get('/icons', (c) => {
    const set = c.req.query('set');
    const result = searchIcons({
      query: (c.req.query('q') ?? '').slice(0, 80),
      set: set === 'icons' || set === 'brands' ? set as IconSet : undefined,
      offset: Math.max(0, Number(c.req.query('offset')) || 0),
      limit: Math.min(120, Math.max(1, Number(c.req.query('limit')) || 60)),
    });
    c.header('cache-control', 'public, max-age=3600');
    return c.json(result);
  });

  /* ---------- gallery ---------- */

  api.get('/designs', (c) => {
    const sortParam = c.req.query('sort');
    const sort: SortOrder = sortParam === 'top' || sortParam === 'new' ? sortParam : 'trending';
    const idsParam = c.req.query('ids');
    const { items, total } = db.listDesigns({
      query: (c.req.query('q') ?? '').slice(0, 80),
      sort,
      ids: idsParam !== undefined ? idsParam.split(',').filter(Boolean).slice(0, 100) : undefined,
      offset: Math.max(0, Number(c.req.query('offset')) || 0),
      limit: Math.min(48, Math.max(1, Number(c.req.query('limit')) || 24)),
    });
    const voter = voterId(c);
    const liked = voter ? db.likedBy(voter, items.map((item) => item.id)) : new Set<string>();
    return c.json({ total, items: items.map((item) => toPublic(item, liked.has(item.id))) });
  });

  api.get('/designs/:id', (c) => {
    const row = db.getDesign(c.req.param('id'));
    if (!row || (row.hidden && !isAdmin(c))) {
      return c.json({ error: 'not_found' }, 404);
    }
    const voter = voterId(c);
    const liked = voter ? db.likedBy(voter, [row.id]).has(row.id) : false;
    return c.json({ ...toPublic(row, liked), options: JSON.parse(row.options) as unknown });
  });

  api.get('/designs/:id/thumbnail', (c) => {
    const row = db.getThumbnail(c.req.param('id'));
    if (!row) {
      return c.body(null, 404);
    }
    // published designs never change, so their thumbnails can be cached forever
    return c.body(new Uint8Array(row.thumbnail), 200, {
      'content-type': row.thumbnail_type,
      'cache-control': 'public, max-age=31536000, immutable',
    });
  });

  api.post('/designs', bodyLimit({ maxSize: LIMITS.options + LIMITS.thumbnail * 1.5 + 10_000 }), async (c) => {
    if (!publishLimit(clientIp(c))) {
      return c.json({ error: 'rate_limited' }, 429);
    }
    let body: Record<string, unknown>;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'invalid_json' }, 400);
    }
    const title = cleanText(body.title, LIMITS.title);
    if (title.length < 2) {
      return c.json({ error: 'title_required' }, 400);
    }
    if (!isDesignOptions(body.options)) {
      return c.json({ error: 'invalid_options' }, 400);
    }
    const options = JSON.stringify(body.options);
    if (options.length > LIMITS.options) {
      return c.json({ error: 'design_too_large' }, 413);
    }
    const thumbnail = parseThumbnail(body.thumbnail);
    if (!thumbnail) {
      return c.json({ error: 'invalid_thumbnail' }, 400);
    }
    const remixOf = typeof body.remixOf === 'string' && db.getDesign(body.remixOf) ? body.remixOf : null;
    const { id, editToken } = db.createDesign({
      title,
      author: cleanText(body.author, LIMITS.author),
      tags: cleanTags(body.tags),
      options,
      thumbnail: thumbnail.bytes,
      thumbnailType: thumbnail.type,
      remixOf,
    });
    return c.json({ design: toPublic(db.getDesign(id)!), editToken }, 201);
  });

  api.delete('/designs/:id', (c) => {
    const id = c.req.param('id');
    if (!db.getDesign(id)) {
      return c.json({ error: 'not_found' }, 404);
    }
    if (!isAdmin(c) && !db.canEdit(id, c.req.header('x-edit-token') ?? '')) {
      return c.json({ error: 'forbidden' }, 403);
    }
    db.deleteDesign(id);
    return c.json({ deleted: true });
  });

  api.post('/designs/:id/like', async (c) => {
    const voter = voterId(c);
    if (!voter) {
      return c.json({ error: 'client_id_required' }, 400);
    }
    if (!voteLimit(clientIp(c))) {
      return c.json({ error: 'rate_limited' }, 429);
    }
    const body = await c.req.json().catch(() => ({})) as { liked?: unknown };
    const liked = body.liked !== false;
    const likes = db.setLike(c.req.param('id'), voter, liked);
    return likes === null ? c.json({ error: 'not_found' }, 404) : c.json({ likes, liked });
  });

  api.post('/designs/:id/report', async (c) => {
    const voter = voterId(c);
    if (!voter) {
      return c.json({ error: 'client_id_required' }, 400);
    }
    if (!reportLimit(clientIp(c))) {
      return c.json({ error: 'rate_limited' }, 429);
    }
    const body = await c.req.json().catch(() => ({})) as { reason?: unknown };
    const id = c.req.param('id');
    const reports = db.report(id, voter, cleanText(body.reason, 300));
    if (reports === null) {
      return c.json({ error: 'not_found' }, 404);
    }
    if (reports >= reportThreshold) {
      db.setHidden(id, true);
    }
    return c.json({ reported: true });
  });

  api.post('/designs/:id/download', (c) => {
    db.countDownload(c.req.param('id'));
    return c.json({ counted: true });
  });

  /* ---------- moderation (Authorization: Bearer <ADMIN_TOKEN>) ---------- */

  api.use('/admin/*', async (c, next) => {
    if (!adminHash) {
      return c.json({ error: 'admin_disabled' }, 404);
    }
    const ip = clientIp(c);
    if (failedAdminLogins(ip, false) >= ADMIN_FAILURES) {
      return c.json({ error: 'rate_limited' }, 429);
    }
    if (!isAdmin(c)) {
      failedAdminLogins(ip, true);
      return c.json({ error: 'unauthorized' }, 401);
    }
    await next();
  });

  const toAdmin = (row: DesignSummary) => ({ ...toPublic(row), reports: row.reports, hidden: !!row.hidden });

  api.get('/admin/designs', (c) => {
    const status = c.req.query('status');
    const sort = c.req.query('sort');
    const { items, total } = db.adminList({
      status: status === 'reported' || status === 'hidden' ? status : 'all',
      sort: sort === 'reports' || sort === 'likes' ? sort : 'new',
      query: (c.req.query('q') ?? '').slice(0, 80),
      offset: Math.max(0, Number(c.req.query('offset')) || 0),
      limit: Math.min(100, Math.max(1, Number(c.req.query('limit')) || 50)),
    });
    return c.json({ total, items: items.map(toAdmin), stats: db.adminStats() });
  });

  api.get('/admin/designs/:id/reports', (c) => c.json({ items: db.reportsOf(c.req.param('id')) }));

  api.get('/admin/designs/:id/thumbnail', (c) => {
    const row = db.adminThumbnail(c.req.param('id'));
    return row
      ? c.body(new Uint8Array(row.thumbnail), 200, { 'content-type': row.thumbnail_type, 'cache-control': 'private, max-age=3600' })
      : c.body(null, 404);
  });

  api.post('/admin/designs/:id', async (c) => {
    const id = c.req.param('id');
    if (!db.getDesign(id)) {
      return c.json({ error: 'not_found' }, 404);
    }
    const body = await c.req.json().catch(() => ({})) as { hidden?: unknown; clearReports?: unknown };
    if (typeof body.hidden === 'boolean') {
      db.setHidden(id, body.hidden);
    }
    if (body.clearReports === true) {
      db.clearReports(id);
    }
    return c.json(toAdmin(db.getDesign(id)!));
  });

  api.delete('/admin/designs/:id', (c) => {
    const id = c.req.param('id');
    if (!db.getDesign(id)) {
      return c.json({ error: 'not_found' }, 404);
    }
    db.deleteDesign(id);
    return c.json({ deleted: true });
  });

  api.notFound((c) => c.json({ error: 'not_found' }, 404));
  api.onError((error, c) => {
    console.error(error);
    return c.json({ error: 'server_error' }, 500);
  });

  return new Hono().route('/api', api);
};

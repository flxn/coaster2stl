import { createHash, randomBytes } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

/**
 * The gallery database: one SQLite file with designs, likes and reports.
 * Designs are immutable once published (a change is a new design, a "remix"); only their counters change.
 */

export interface DesignRow {
  id: string;
  title: string;
  author: string;
  tags: string;
  options: string;
  thumbnail: Uint8Array;
  thumbnail_type: string;
  remix_of: string | null;
  edit_token_hash: string;
  likes: number;
  downloads: number;
  reports: number;
  hidden: number;
  created_at: string;
}

export type DesignSummary = Omit<DesignRow, 'options' | 'thumbnail' | 'edit_token_hash'>;

export type SortOrder = 'trending' | 'top' | 'new';
export type AdminStatus = 'all' | 'reported' | 'hidden';
export type AdminSort = 'new' | 'reports' | 'likes';

const MIGRATIONS = [
  `
  CREATE TABLE designs (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    author TEXT NOT NULL DEFAULT '',
    tags TEXT NOT NULL DEFAULT '',
    options TEXT NOT NULL,
    thumbnail BLOB NOT NULL,
    thumbnail_type TEXT NOT NULL,
    remix_of TEXT,
    edit_token_hash TEXT NOT NULL,
    likes INTEGER NOT NULL DEFAULT 0,
    downloads INTEGER NOT NULL DEFAULT 0,
    reports INTEGER NOT NULL DEFAULT 0,
    hidden INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );
  CREATE INDEX designs_created ON designs (created_at);
  CREATE INDEX designs_likes ON designs (likes);
  CREATE TABLE likes (
    design_id TEXT NOT NULL REFERENCES designs (id) ON DELETE CASCADE,
    voter TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    PRIMARY KEY (design_id, voter)
  );
  CREATE TABLE reports (
    design_id TEXT NOT NULL REFERENCES designs (id) ON DELETE CASCADE,
    reporter TEXT NOT NULL,
    reason TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    PRIMARY KEY (design_id, reporter)
  );
  CREATE VIRTUAL TABLE designs_fts USING fts5 (title, author, tags, content = 'designs', content_rowid = 'rowid');
  CREATE TRIGGER designs_ai AFTER INSERT ON designs BEGIN
    INSERT INTO designs_fts (rowid, title, author, tags) VALUES (new.rowid, new.title, new.author, new.tags);
  END;
  CREATE TRIGGER designs_ad AFTER DELETE ON designs BEGIN
    INSERT INTO designs_fts (designs_fts, rowid, title, author, tags) VALUES ('delete', old.rowid, old.title, old.author, old.tags);
  END;
  `,
];

const SUMMARY_COLUMNS = 'id, title, author, tags, thumbnail_type, remix_of, likes, downloads, reports, hidden, created_at';

const ORDER: Record<SortOrder, string> = {
  // likes decay with age (in hours), so new designs with a few likes rise above old favorites
  trending: `(likes + 1) / pow((julianday('now') - julianday(created_at)) * 24 + 2, 1.4) DESC, created_at DESC`,
  top: 'likes DESC, created_at DESC',
  new: 'created_at DESC',
};

const ID_ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789';

const newId = () => Array.from(randomBytes(8), (byte) => ID_ALPHABET[byte % ID_ALPHABET.length]).join('');

export const hashSecret = (value: string) => createHash('sha256').update(value).digest('hex');

/** Turns user input into an FTS5 prefix query (every word must match, as a prefix). */
const ftsQuery = (query: string) => query
  .toLowerCase()
  .split(/[^\p{L}\p{N}]+/u)
  .filter(Boolean)
  .slice(0, 8)
  .map((word) => `"${word}"*`)
  .join(' ');

export const openDatabase = (file: string) => {
  if (file !== ':memory:') {
    mkdirSync(dirname(file), { recursive: true });
  }
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 3000;');
  const { user_version: version } = db.prepare('PRAGMA user_version').get() as { user_version: number };
  MIGRATIONS.slice(version).forEach((sql, index) => {
    db.exec('BEGIN');
    db.exec(sql);
    db.exec(`PRAGMA user_version = ${version + index + 1}`);
    db.exec('COMMIT');
  });

  const statements = {
    insert: db.prepare(`INSERT INTO designs (id, title, author, tags, options, thumbnail, thumbnail_type, remix_of, edit_token_hash)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`),
    get: db.prepare(`SELECT ${SUMMARY_COLUMNS}, options FROM designs WHERE id = ?`),
    thumbnail: db.prepare('SELECT thumbnail, thumbnail_type FROM designs WHERE id = ? AND hidden = 0'),
    token: db.prepare('SELECT edit_token_hash FROM designs WHERE id = ?'),
    remove: db.prepare('DELETE FROM designs WHERE id = ?'),
    like: db.prepare('INSERT OR IGNORE INTO likes (design_id, voter) VALUES (?, ?)'),
    unlike: db.prepare('DELETE FROM likes WHERE design_id = ? AND voter = ?'),
    countLikes: db.prepare('UPDATE designs SET likes = (SELECT count(*) FROM likes WHERE design_id = designs.id) WHERE id = ? RETURNING likes'),
    hasLiked: db.prepare('SELECT 1 FROM likes WHERE design_id = ? AND voter = ?'),
    report: db.prepare('INSERT OR IGNORE INTO reports (design_id, reporter, reason) VALUES (?, ?, ?)'),
    countReports: db.prepare('UPDATE designs SET reports = (SELECT count(*) FROM reports WHERE design_id = designs.id) WHERE id = ? RETURNING reports'),
    hide: db.prepare('UPDATE designs SET hidden = ? WHERE id = ?'),
    download: db.prepare('UPDATE designs SET downloads = downloads + 1 WHERE id = ? AND hidden = 0'),
    adminThumbnail: db.prepare('SELECT thumbnail, thumbnail_type FROM designs WHERE id = ?'),
    reportsOf: db.prepare('SELECT reason, created_at FROM reports WHERE design_id = ? ORDER BY created_at DESC LIMIT 100'),
    clearReports: db.prepare('DELETE FROM reports WHERE design_id = ?'),
    resetReports: db.prepare('UPDATE designs SET reports = 0 WHERE id = ?'),
    stats: db.prepare('SELECT count(*) AS designs, coalesce(sum(likes), 0) AS likes FROM designs WHERE hidden = 0'),
    adminStats: db.prepare(`SELECT count(*) AS designs, coalesce(sum(hidden), 0) AS hidden,
      coalesce(sum(reports > 0 AND hidden = 0), 0) AS reported, coalesce(sum(likes), 0) AS likes,
      coalesce(sum(downloads), 0) AS downloads FROM designs`),
  };

  return {
    db,

    /** Stores a new design; returns its id and the secret token that allows deleting it. */
    createDesign(input: {
      title: string; author: string; tags: string[]; options: string; thumbnail: Uint8Array; thumbnailType: string; remixOf: string | null;
    }) {
      const id = newId();
      const editToken = randomBytes(24).toString('base64url');
      statements.insert.run(
        id,
        input.title,
        input.author,
        input.tags.join(','),
        input.options,
        input.thumbnail,
        input.thumbnailType,
        input.remixOf,
        hashSecret(editToken),
      );
      return { id, editToken };
    },

    getDesign(id: string) {
      return statements.get.get(id) as (DesignSummary & { options: string }) | undefined;
    },

    getThumbnail(id: string) {
      return statements.thumbnail.get(id) as { thumbnail: Uint8Array; thumbnail_type: string } | undefined;
    },

    listDesigns({
      query = '', sort = 'trending', ids, offset = 0, limit = 24,
    }: { query?: string; sort?: SortOrder; ids?: string[]; offset?: number; limit?: number }) {
      const where = ['hidden = 0'];
      const params: (string | number)[] = [];
      const fts = ftsQuery(query);
      if (fts) {
        where.push('rowid IN (SELECT rowid FROM designs_fts WHERE designs_fts MATCH ?)');
        params.push(fts);
      }
      if (ids) {
        if (!ids.length) {
          return { items: [] as DesignSummary[], total: 0 };
        }
        where.push(`id IN (${ids.map(() => '?').join(', ')})`);
        params.push(...ids);
      }
      const condition = where.join(' AND ');
      const { total } = db.prepare(`SELECT count(*) AS total FROM designs WHERE ${condition}`).get(...params) as { total: number };
      const items = db.prepare(`SELECT ${SUMMARY_COLUMNS} FROM designs WHERE ${condition} ORDER BY ${ORDER[sort]} LIMIT ? OFFSET ?`)
        .all(...params, limit, offset) as unknown as DesignSummary[];
      return { items, total };
    },

    likedBy(voter: string, ids: string[]): Set<string> {
      return new Set(ids.filter((id) => statements.hasLiked.get(id, voter)));
    },

    setLike(id: string, voter: string, liked: boolean): number | null {
      (liked ? statements.like : statements.unlike).run(id, voter);
      const row = statements.countLikes.get(id) as { likes: number } | undefined;
      return row ? row.likes : null;
    },

    /** Records a report; returns the number of reports so far. */
    report(id: string, reporter: string, reason: string): number | null {
      statements.report.run(id, reporter, reason);
      const row = statements.countReports.get(id) as { reports: number } | undefined;
      return row ? row.reports : null;
    },

    setHidden(id: string, hidden: boolean) {
      statements.hide.run(hidden ? 1 : 0, id);
    },

    countDownload(id: string) {
      statements.download.run(id);
    },

    /** Whether `token` is the edit token of the design. */
    canEdit(id: string, token: string) {
      const row = statements.token.get(id) as { edit_token_hash: string } | undefined;
      return !!row && !!token && row.edit_token_hash === hashSecret(token);
    },

    deleteDesign(id: string) {
      statements.remove.run(id);
    },

    stats() {
      return statements.stats.get() as { designs: number; likes: number };
    },

    /* ---------- moderation ---------- */

    /** All designs for moderators, hidden ones included. */
    adminList({
      status = 'all', query = '', sort = 'new', offset = 0, limit = 50,
    }: { status?: AdminStatus; query?: string; sort?: AdminSort; offset?: number; limit?: number }) {
      const where = ['1 = 1'];
      const params: (string | number)[] = [];
      if (status === 'reported') where.push('reports > 0 AND hidden = 0');
      if (status === 'hidden') where.push('hidden = 1');
      const fts = ftsQuery(query);
      if (fts) {
        where.push('(rowid IN (SELECT rowid FROM designs_fts WHERE designs_fts MATCH ?) OR id = ?)');
        params.push(fts, query.trim().toLowerCase());
      }
      const condition = where.join(' AND ');
      const order = {
        new: 'created_at DESC',
        reports: 'reports DESC, created_at DESC',
        likes: 'likes DESC, created_at DESC',
      }[sort];
      const { total } = db.prepare(`SELECT count(*) AS total FROM designs WHERE ${condition}`).get(...params) as { total: number };
      const items = db.prepare(`SELECT ${SUMMARY_COLUMNS} FROM designs WHERE ${condition} ORDER BY ${order} LIMIT ? OFFSET ?`)
        .all(...params, limit, offset) as unknown as DesignSummary[];
      return { items, total };
    },

    adminStats() {
      return statements.adminStats.get() as { designs: number; hidden: number; reported: number; likes: number; downloads: number };
    },

    adminThumbnail(id: string) {
      return statements.adminThumbnail.get(id) as { thumbnail: Uint8Array; thumbnail_type: string } | undefined;
    },

    reportsOf(id: string) {
      return statements.reportsOf.all(id) as { reason: string; created_at: string }[];
    },

    /** Marks the reports of a design as handled. */
    clearReports(id: string) {
      statements.clearReports.run(id);
      statements.resetReports.run(id);
    },
  };
};

export type Database = ReturnType<typeof openDatabase>;

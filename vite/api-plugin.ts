import { resolve } from 'node:path';
import { getRequestListener } from '@hono/node-server';
import type { Plugin } from 'vite';
import { createApi } from '../server/app.ts';
import { openDatabase } from '../server/db.ts';

/**
 * Serves the gallery and icon API (server/app.ts) from the Vite dev server, so `npm run dev` is all
 * you need. The development database lives in data/dev.db. Vite restarts when the server code changes.
 */
export default function apiPlugin(): Plugin {
  return {
    name: 'coaster2stl-api',
    apply: 'serve',
    configureServer(server) {
      const db = openDatabase(resolve(server.config.root, 'data', 'dev.db'));
      const listener = getRequestListener(createApi({ db, adminToken: process.env.ADMIN_TOKEN ?? 'dev' }).fetch);
      server.middlewares.use((req, res, next) => {
        if (req.url?.startsWith('/api/')) {
          listener(req, res);
          return;
        }
        // the moderation page, like the production server serves it
        if (req.url === '/admin' || req.url?.startsWith('/admin?')) {
          req.url = req.url.replace('/admin', '/admin.html');
        }
        next();
      });
      server.httpServer?.on('close', () => db.db.close());
    },
  };
}

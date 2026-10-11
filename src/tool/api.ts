/**
 * Client for the gallery and icon API (server/app.ts). There are no accounts: the browser keeps an
 * anonymous id (for likes and reports) and the secret edit tokens of the designs it published.
 */
import type { ToolOptions } from './options';

export interface GalleryDesign {
  id: string;
  title: string;
  author: string;
  tags: string[];
  likes: number;
  downloads: number;
  remixOf: string | null;
  createdAt: string;
  thumbnail: string;
  liked: boolean;
}

export interface GalleryDesignDetail extends GalleryDesign {
  options: ToolOptions;
}

export type GallerySort = 'trending' | 'top' | 'new';

export interface LibraryIcon {
  id: string;
  name: string;
  set: 'icons' | 'brands';
  path: string;
  hex?: string;
}

const CLIENT_KEY = 'coaster2stl:client';
const OWNED_KEY = 'coaster2stl:owned';
const AUTHOR_KEY = 'coaster2stl:author';

const storage = {
  get(key: string) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // private mode: works for this session only
    }
  },
};

let clientId: string | null = null;
const getClientId = () => {
  clientId ??= storage.get(CLIENT_KEY);
  if (!clientId || !/^[A-Za-z0-9-]{16,64}$/.test(clientId)) {
    clientId = crypto.randomUUID();
    storage.set(CLIENT_KEY, clientId);
  }
  return clientId;
};

export class ApiError extends Error {
  code: string;

  status: number;

  constructor(code: string, status: number) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

const request = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      ...init,
      headers: {
        'content-type': 'application/json',
        'x-client-id': getClientId(),
        ...(init.headers ?? {}),
      },
    });
  } catch {
    throw new ApiError('offline', 0);
  }
  const body = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) {
    throw new ApiError(body.error ?? 'server_error', response.status);
  }
  return body;
};

/* ---------- designs I published ---------- */

const readOwned = (): Record<string, string> => {
  try {
    return JSON.parse(storage.get(OWNED_KEY) ?? '{}') as Record<string, string>;
  } catch {
    return {};
  }
};

export const ownedDesignIds = () => Object.keys(readOwned());
export const ownsDesign = (id: string) => id in readOwned();

export const rememberedAuthor = () => storage.get(AUTHOR_KEY) ?? '';

/* ---------- API calls ---------- */

export const listDesigns = (params: { q?: string; sort?: GallerySort; offset?: number; limit?: number; mine?: boolean }) => {
  const query = new URLSearchParams();
  if (params.q) query.set('q', params.q);
  query.set('sort', params.sort ?? 'trending');
  query.set('offset', String(params.offset ?? 0));
  query.set('limit', String(params.limit ?? 24));
  if (params.mine) query.set('ids', ownedDesignIds().join(','));
  return request<{ total: number; items: GalleryDesign[] }>(`/designs?${query}`);
};

export const getDesign = (id: string) => request<GalleryDesignDetail>(`/designs/${encodeURIComponent(id)}`);

export const publishDesign = async (input: {
  title: string; author: string; tags: string; options: ToolOptions; thumbnail: string; remixOf: string | null;
}) => {
  const result = await request<{ design: GalleryDesign; editToken: string }>('/designs', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  storage.set(OWNED_KEY, JSON.stringify({ ...readOwned(), [result.design.id]: result.editToken }));
  storage.set(AUTHOR_KEY, input.author);
  return result.design;
};

export const deleteDesign = async (id: string) => {
  const owned = readOwned();
  await request(`/designs/${encodeURIComponent(id)}`, { method: 'DELETE', headers: { 'x-edit-token': owned[id] ?? '' } });
  delete owned[id];
  storage.set(OWNED_KEY, JSON.stringify(owned));
};

export const setLiked = (id: string, liked: boolean) => request<{ likes: number; liked: boolean }>(
  `/designs/${encodeURIComponent(id)}/like`,
  { method: 'POST', body: JSON.stringify({ liked }) },
);

export const reportDesign = (id: string, reason: string) => request(`/designs/${encodeURIComponent(id)}/report`, {
  method: 'POST',
  body: JSON.stringify({ reason }),
});

export const countDownload = (id: string) => request(`/designs/${encodeURIComponent(id)}/download`, { method: 'POST' }).catch(() => {});

export const searchIcons = (params: { q: string; set: 'icons' | 'brands'; offset?: number; limit?: number }) => {
  const query = new URLSearchParams({
    q: params.q, set: params.set, offset: String(params.offset ?? 0), limit: String(params.limit ?? 72),
  });
  return request<{ total: number; items: LibraryIcon[] }>(`/icons?${query}`);
};

/** Absolute share link of a design, in the current language. */
export const designUrl = (id: string) => {
  const locale = window.location.pathname.split('/')[1];
  const prefix = /^[a-z]{2}$/.test(locale) ? `/${locale}` : '';
  return `${window.location.origin}${prefix}/d/${id}`;
};

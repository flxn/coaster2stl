/**
 * Client for the moderation API (server/app.ts, /api/admin/*). The admin token is kept in
 * sessionStorage only, so it is gone when the tab is closed.
 */
import { ref } from 'vue';

const TOKEN_KEY = 'coaster2stl:admin-token';

export interface AdminDesign {
  id: string;
  title: string;
  author: string;
  tags: string[];
  likes: number;
  downloads: number;
  reports: number;
  hidden: boolean;
  remixOf: string | null;
  createdAt: string;
}

export interface AdminStats {
  designs: number;
  hidden: number;
  reported: number;
  likes: number;
  downloads: number;
}

export type AdminStatus = 'reported' | 'hidden' | 'all';
export type AdminSort = 'new' | 'reports' | 'likes';

const readToken = () => {
  try {
    return window.sessionStorage.getItem(TOKEN_KEY) ?? '';
  } catch {
    return '';
  }
};

export const token = ref(readToken());

const setToken = (value: string) => {
  token.value = value;
  try {
    if (value) window.sessionStorage.setItem(TOKEN_KEY, value);
    else window.sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // the token works for this page view only
  }
};

export class AdminError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const thumbnails = new Map<string, Promise<string>>();

export const signOut = () => {
  setToken('');
  thumbnails.forEach((url) => url.then(URL.revokeObjectURL).catch(() => {}));
  thumbnails.clear();
};

const request = async (path: string, init: RequestInit = {}, authToken = token.value): Promise<Response> => {
  let response: Response;
  try {
    response = await fetch(`/api/admin${path}`, {
      ...init,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${authToken}`, ...(init.headers ?? {}) },
    });
  } catch {
    throw new AdminError('offline', 0);
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string };
    if (response.status === 401 && authToken === token.value) {
      signOut();
    }
    throw new AdminError(body.error ?? 'server_error', response.status);
  }
  return response;
};

/** Checks a token against the server and keeps it when it is valid. */
export const signIn = async (value: string) => {
  await request('/designs?limit=1', {}, value);
  setToken(value);
};

export const listDesigns = async (params: { status: AdminStatus; q: string; sort: AdminSort; offset: number }) => {
  const query = new URLSearchParams({
    status: params.status, q: params.q, sort: params.sort, offset: String(params.offset), limit: '30',
  });
  return (await request(`/designs?${query}`)).json() as Promise<{ total: number; items: AdminDesign[]; stats: AdminStats }>;
};

export const listReports = async (id: string) => (
  (await request(`/designs/${encodeURIComponent(id)}/reports`)).json() as Promise<{ items: { reason: string; created_at: string }[] }>
);

export const updateDesign = async (id: string, change: { hidden?: boolean; clearReports?: boolean }) => (
  (await request(`/designs/${encodeURIComponent(id)}`, { method: 'POST', body: JSON.stringify(change) })).json() as Promise<AdminDesign>
);

export const deleteDesign = async (id: string) => {
  await request(`/designs/${encodeURIComponent(id)}`, { method: 'DELETE' });
};

/** Thumbnail as an object URL (hidden designs are not public, so images need the token too). */
export const thumbnailUrl = (id: string): Promise<string> => {
  let url = thumbnails.get(id);
  if (!url) {
    url = request(`/designs/${encodeURIComponent(id)}/thumbnail`).then(async (response) => URL.createObjectURL(await response.blob()));
    thumbnails.set(id, url);
    url.catch(() => thumbnails.delete(id));
  }
  return url;
};

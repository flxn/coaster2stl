import { describe, expect, it } from 'vitest';
import { createApi } from './app.ts';
import { openDatabase } from './db.ts';

// 1×1 transparent PNG
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const OPTIONS = { coaster: { shape: 'circle' }, colors: { base: '#ffffff' } };

const setup = () => {
  const app = createApi({ db: openDatabase(':memory:'), adminToken: 'secret', reportThreshold: 2 });
  const call = (path: string, init: RequestInit & { client?: string } = {}) => app.request(`/api${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init.client ? { 'x-client-id': init.client } : {}),
      ...(init.headers ?? {}),
    },
  });
  const publish = async (title = 'Morning Coffee', extra: Record<string, unknown> = {}) => {
    const response = await call('/designs', {
      method: 'POST',
      body: JSON.stringify({
        title, author: 'Felix', tags: 'coffee, #Morning, coffee', options: OPTIONS, thumbnail: PNG, ...extra,
      }),
    });
    return { response, body: await response.json() as { design: { id: string; tags: string[] }; editToken: string } };
  };
  return { call, publish };
};

const CLIENT_A = 'client-aaaaaaaaaaaaaaaa';
const CLIENT_B = 'client-bbbbbbbbbbbbbbbb';

describe('gallery api', () => {
  it('publishes, lists, searches and returns designs', async () => {
    const { call, publish } = setup();
    const { response, body } = await publish();
    expect(response.status).toBe(201);
    expect(body.design.tags).toEqual(['coffee', 'morning']);
    await publish('Beach Bar Sunset', { tags: 'beach' });

    const list = await (await call('/designs?sort=new')).json() as { total: number; items: { title: string }[] };
    expect(list.total).toBe(2);
    expect(list.items[0].title).toBe('Beach Bar Sunset');

    const search = await (await call('/designs?q=morn')).json() as { items: { title: string }[] };
    expect(search.items.map((item) => item.title)).toEqual(['Morning Coffee']);

    const detail = await (await call(`/designs/${body.design.id}`)).json() as { options: unknown };
    expect(detail.options).toEqual(OPTIONS);

    const thumbnail = await call(`/designs/${body.design.id}/thumbnail`);
    expect(thumbnail.headers.get('content-type')).toBe('image/png');
  });

  it('rejects incomplete designs', async () => {
    const { publish } = setup();
    expect((await publish('x')).response.status).toBe(400);
    expect((await publish('Valid title', { thumbnail: 'data:text/html;base64,PGI+' })).response.status).toBe(400);
    expect((await publish('Valid title', { options: { nope: true } })).response.status).toBe(400);
  });

  it('counts one like per browser and sorts by likes', async () => {
    const { call, publish } = setup();
    const first = (await publish('First')).body.design.id;
    const second = (await publish('Second')).body.design.id;
    const like = (id: string, client: string, liked = true) => call(`/designs/${id}/like`, { method: 'POST', client, body: JSON.stringify({ liked }) });
    await like(first, CLIENT_A);
    await like(first, CLIENT_A);
    expect(await (await like(first, CLIENT_B)).json()).toEqual({ likes: 2, liked: true });
    expect(await (await like(first, CLIENT_B, false)).json()).toEqual({ likes: 1, liked: false });
    expect((await call(`/designs/${second}/like`, { method: 'POST' })).status).toBe(400);

    const top = await (await call('/designs?sort=top', { client: CLIENT_A })).json() as { items: { id: string; liked: boolean }[] };
    expect(top.items.map((item) => [item.id, item.liked])).toEqual([[first, true], [second, false]]);
  });

  it('hides reported designs and lets the owner delete', async () => {
    const { call, publish } = setup();
    const { body } = await publish();
    const { id } = body.design;
    await call(`/designs/${id}/report`, { method: 'POST', client: CLIENT_A, body: '{}' });
    await call(`/designs/${id}/report`, { method: 'POST', client: CLIENT_B, body: '{}' });
    expect((await call(`/designs/${id}`)).status).toBe(404);
    expect((await call(`/designs/${id}`, { headers: { authorization: 'Bearer secret' } })).status).toBe(200);

    expect((await call(`/designs/${id}`, { method: 'DELETE', headers: { 'x-edit-token': 'wrong' } })).status).toBe(403);
    expect((await call(`/designs/${id}`, { method: 'DELETE', headers: { 'x-edit-token': body.editToken } })).status).toBe(200);
  });

  it('guards the moderation endpoints', async () => {
    const { call, publish } = setup();
    await publish();
    expect((await call('/admin/designs')).status).toBe(401);
    expect((await call('/admin/designs', { headers: { authorization: 'Bearer wrong' } })).status).toBe(401);
    // after 10 wrong tokens the IP is locked out, even with the right one
    for (let i = 0; i < 10; i += 1) {
      await call('/admin/designs', { headers: { authorization: 'Bearer wrong', 'x-forwarded-for': '10.0.0.1' } });
    }
    expect((await call('/admin/designs', { headers: { authorization: 'Bearer secret', 'x-forwarded-for': '10.0.0.1' } })).status).toBe(429);
    expect((await call('/admin/designs', { headers: { authorization: 'Bearer secret', 'x-forwarded-for': '10.0.0.2' } })).status).toBe(200);

    const disabled = createApi({ db: openDatabase(':memory:') });
    expect((await disabled.request('/api/admin/designs', { headers: { authorization: 'Bearer ' } })).status).toBe(404);
  });

  it('lists, hides, restores and deletes designs for moderators', async () => {
    const { call, publish } = setup();
    const admin = { authorization: 'Bearer secret' };
    const reported = (await publish('Reported one')).body.design.id;
    await publish('Fine one');
    await call(`/designs/${reported}/report`, { method: 'POST', client: CLIENT_A, body: JSON.stringify({ reason: 'spam' }) });

    type List = { total: number; items: { id: string; reports: number; hidden: boolean }[]; stats: { reported: number; hidden: number } };
    const list = async (query: string) => await (await call(`/admin/designs?${query}`, { headers: admin })).json() as List;
    expect((await list('status=reported')).items.map((item) => item.id)).toEqual([reported]);
    expect((await list('status=all')).stats).toMatchObject({ reported: 1, hidden: 0 });
    expect((await list(`q=${reported}`)).total).toBe(1);

    const reports = await (await call(`/admin/designs/${reported}/reports`, { headers: admin })).json() as { items: { reason: string }[] };
    expect(reports.items[0].reason).toBe('spam');

    const dismiss = await (await call(`/admin/designs/${reported}`, { method: 'POST', headers: admin, body: JSON.stringify({ clearReports: true }) })).json();
    expect(dismiss).toMatchObject({ reports: 0, hidden: false });

    await call(`/admin/designs/${reported}`, { method: 'POST', headers: admin, body: JSON.stringify({ hidden: true }) });
    expect((await call(`/designs/${reported}/thumbnail`)).status).toBe(404);
    expect((await call(`/admin/designs/${reported}/thumbnail`, { headers: admin })).status).toBe(200);
    expect((await list('status=hidden')).total).toBe(1);

    await call(`/admin/designs/${reported}`, { method: 'POST', headers: admin, body: JSON.stringify({ hidden: false }) });
    expect((await call(`/designs/${reported}`)).status).toBe(200);

    expect((await call(`/admin/designs/${reported}`, { method: 'DELETE', headers: admin })).status).toBe(200);
    expect((await call(`/designs/${reported}`)).status).toBe(404);
  });

  it('searches the icon and brand library', async () => {
    const { call } = setup();
    const coffee = await (await call('/icons?q=coffee')).json() as { total: number; items: { id: string; path: string }[] };
    expect(coffee.items[0].id).toBe('mdi:coffee');
    expect(coffee.items[0].path).toMatch(/^M/);
    const brands = await (await call('/icons?q=github&set=brands')).json() as { items: { id: string; hex: string }[] };
    expect(brands.items[0]).toMatchObject({ id: 'brands:github', hex: '#181717' });
    const featured = await (await call('/icons?set=icons&limit=3')).json() as { items: { id: string }[] };
    expect(featured.items.map((item) => item.id)).toEqual(['mdi:coffee', 'mdi:tea', 'mdi:glass-mug-variant']);
  });
});

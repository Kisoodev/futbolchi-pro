import { describe, expect, it } from 'vitest';
import { newGame, playWeek, trainingOffer, type GameState } from '@futbolchi/engine';
import { buildApp } from '../src/app';
import { MockPaymentProvider } from '../src/payments/MockPaymentProvider';
import { JsonStore } from '../src/store/jsonStore';

const TOKEN = 'admin-test';

function gameWithMatches(weeks: number): GameState {
  let s = newGame({ seed: 5, persona: { id: 'p', name: 'Aziz', position: 'ST', bonus: {} } });
  for (let i = 0; i < weeks; i++) s = playWeek(s, trainingOffer(s)[0]).state;
  return s;
}

async function setup() {
  const store = new JsonStore(null);
  const { app } = buildApp({ store, provider: new MockPaymentProvider('x'), adminToken: TOKEN });
  const game = gameWithMatches(3);
  const put = await app.inject({ method: 'PUT', url: '/api/saves/u1', payload: game });
  expect(put.statusCode).toBe(200);
  return { app, game, headers: { 'x-admin-token': TOKEN } };
}

describe('browser landing', () => {
  it('redirects / to the game when webUrl is set, and never 404s', async () => {
    const withWeb = buildApp({ store: new JsonStore(null), provider: new MockPaymentProvider('x'), adminToken: null, webUrl: 'http://localhost:5173' }).app;
    const r = await withWeb.inject({ method: 'GET', url: '/' });
    expect(r.statusCode).toBe(302);
    expect(r.headers.location).toBe('http://localhost:5173');
    expect((await withWeb.inject({ method: 'GET', url: '/favicon.ico' })).statusCode).toBe(204);

    const apiOnly = buildApp({ store: new JsonStore(null), provider: new MockPaymentProvider('x'), adminToken: null }).app;
    const r2 = await apiOnly.inject({ method: 'GET', url: '/' });
    expect(r2.statusCode).toBe(200);
    expect(r2.json()).toEqual({ ok: true, service: 'futbolchi-api' });
    await withWeb.close();
    await apiOnly.close();
  });
});

describe('admin highlight stub', () => {
  it('requires the admin token', async () => {
    const { app } = await setup();
    expect((await app.inject({ method: 'GET', url: '/api/admin/matches' })).statusCode).toBe(401);
    expect((await app.inject({ method: 'GET', url: '/api/admin/matches', headers: { 'x-admin-token': 'wrong' } })).statusCode).toBe(401);
    await app.close();
  });

  it('is disabled when no token is configured', async () => {
    const { app } = buildApp({ store: new JsonStore(null), provider: new MockPaymentProvider('x'), adminToken: null });
    expect((await app.inject({ method: 'GET', url: '/api/admin/matches', headers: { 'x-admin-token': '' } })).statusCode).toBe(503);
    await app.close();
  });

  it('lists matches and their events', async () => {
    const { app, game, headers } = await setup();
    const list = (await app.inject({ method: 'GET', url: '/api/admin/matches', headers })).json().matches;
    expect(list).toHaveLength(3);
    const m = list[0];
    const ev = await app.inject({ method: 'GET', url: `/api/admin/matches/${m.matchId}/events?userId=u1`, headers });
    expect(ev.statusCode).toBe(200);
    expect(ev.json().events.map((e: { id: string }) => e.id)).toEqual(game.matches[m.matchId].events.map((e) => e.id));
    expect((await app.inject({ method: 'GET', url: `/api/admin/matches/nope/events?userId=u1`, headers })).statusCode).toBe(404);
    await app.close();
  });

  it('marks a set of events as highlights; re-marking replaces the set', async () => {
    const { app, game, headers } = await setup();
    const matchId = Object.keys(game.matches)[0];
    const ids = game.matches[matchId].events.map((e) => e.id);
    expect(ids.length).toBeGreaterThan(1);
    const url = `/api/admin/matches/${matchId}/highlights`;

    const r1 = await app.inject({ method: 'POST', url, headers, payload: { userId: 'u1', eventIds: [ids[0], ids[1], ids[0]] } });
    expect(r1.statusCode).toBe(200);
    const marked1 = r1.json().events.filter((e: { highlight: boolean }) => e.highlight).map((e: { id: string }) => e.id);
    expect(marked1).toEqual([ids[0], ids[1]]);

    const r2 = await app.inject({ method: 'POST', url, headers, payload: { userId: 'u1', eventIds: [ids[1]] } });
    expect(r2.json().events.filter((e: { highlight: boolean }) => e.highlight)).toHaveLength(1);

    // Highlights survive a client save sync (stored separately from the save).
    await app.inject({ method: 'PUT', url: '/api/saves/u1', payload: game });
    const ev = (await app.inject({ method: 'GET', url: `/api/admin/matches/${matchId}/events?userId=u1`, headers })).json().events;
    expect(ev.find((e: { id: string }) => e.id === ids[1]).highlight).toBe(true);
    await app.close();
  });

  it('rejects event ids that do not belong to the match', async () => {
    const { app, game, headers } = await setup();
    const matchId = Object.keys(game.matches)[0];
    const r = await app.inject({ method: 'POST', url: `/api/admin/matches/${matchId}/highlights`, headers, payload: { userId: 'u1', eventIds: ['bogus'] } });
    expect(r.statusCode).toBe(400);
    expect(r.json().unknown).toEqual(['bogus']);
    await app.close();
  });

  it('rejects malformed saves', async () => {
    const { app } = await setup();
    expect((await app.inject({ method: 'PUT', url: '/api/saves/u2', payload: { version: 2 } })).statusCode).toBe(400);
    await app.close();
  });
});

describe('secret admin nickname', () => {
  it('opens the admin door without registering the name, only when admin is enabled', async () => {
    const store = new JsonStore(null);
    const { app } = buildApp({ store, provider: new MockPaymentProvider('x'), adminToken: TOKEN, adminNick: 'Boss77' });
    const secret = await app.inject({ method: 'POST', url: '/api/users', payload: { userId: 'u9', name: ' boss77 ' } });
    expect(secret.json()).toEqual({ admin: true });
    expect(store.read((db) => db.users.u9)).toBeUndefined();
    const normal = await app.inject({ method: 'POST', url: '/api/users', payload: { userId: 'u9', name: 'Jasur' } });
    expect(normal.json().user.name).toBe('Jasur');
    await app.close();

    const disabled = buildApp({ store: new JsonStore(null), provider: new MockPaymentProvider('x'), adminToken: null, adminNick: 'Boss77' }).app;
    const r = await disabled.inject({ method: 'POST', url: '/api/users', payload: { userId: 'u9', name: 'Boss77' } });
    expect(r.json().user.name).toBe('Boss77');
    await disabled.close();
  });
});

import { describe, expect, it } from 'vitest';
import { buildApp } from './helpers';
import { ManualPaymentProvider } from '../src/payments/ManualPaymentProvider';
import { JsonStore } from '../src/store/jsonStore';
import { PROOF_MAX_BYTES, parseProofDataUrl } from '../src/store/proofStorage';

const TOKEN = 'admin-test';
const admin = { 'x-admin-token': TOKEN };
/** 1×1 transparent PNG. */
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

function setup() {
  const store = new JsonStore(null);
  const { app, payments } = buildApp({
    store,
    provider: new ManualPaymentProvider('secret'),
    adminToken: TOKEN,
    paymentCard: { number: '0000 0000 0000 0000', holder: 'TEST' },
  });
  const counts = () => store.read((db) => ({ entitlements: Object.keys(db.entitlements).length, receipts: Object.keys(db.receipts).length }));
  const post = (url: string, payload: unknown, headers: Record<string, string> = {}) => app.inject({ method: 'POST', url, payload: payload as object, headers });
  const get = (url: string, headers: Record<string, string> = {}) => app.inject({ method: 'GET', url, headers });
  return { app, store, payments, counts, post, get };
}

async function payWithProof(ctx: ReturnType<typeof setup>, userId = 'u1') {
  const { paymentId } = (await ctx.post('/api/payments', { userId, product: 'persona_slot' })).json();
  const up = await ctx.post(`/api/payments/${paymentId}/proof`, { userId, dataUrl: PNG });
  expect(up.statusCode).toBe(200);
  return paymentId as string;
}

describe('registration and counter', () => {
  it('counts registered users once each and validates names', async () => {
    const ctx = setup();
    expect((await ctx.get('/api/stats')).json()).toEqual({ registered: 0 });
    expect((await ctx.post('/api/users', { userId: 'u1', name: '  Aziz ' })).json().user.name).toBe('Aziz');
    await ctx.post('/api/users', { userId: 'u1', name: 'Azizbek' }); // rename, not a new user
    await ctx.post('/api/users', { userId: 'u2', name: 'Sardor' });
    expect((await ctx.get('/api/stats')).json()).toEqual({ registered: 2 });
    expect((await ctx.post('/api/users', { userId: 'u3', name: 'A' })).statusCode).toBe(400);
    expect((await ctx.post('/api/users', { userId: 'u3', name: 'x'.repeat(25) })).statusCode).toBe(400);
    expect((await ctx.post('/api/users', { name: 'Aziz' })).statusCode).toBe(400);
  });

  it('config exposes price and card for manual payments', async () => {
    const cfg = (await setup().get('/api/config')).json();
    expect(cfg.provider).toBe('manual');
    expect(cfg.product.amountMinor).toBe(500_000); // 5 000 so'm
    expect(cfg.card.number).toBe('0000 0000 0000 0000');
  });
});

describe('manual payment with receipt upload', () => {
  it('reuses the open payment instead of creating a new one', async () => {
    const ctx = setup();
    const a = (await ctx.post('/api/payments', { userId: 'u1', product: 'persona_slot' })).json();
    const b = (await ctx.post('/api/payments', { userId: 'u1', product: 'persona_slot' })).json();
    expect(b.paymentId).toBe(a.paymentId);
    expect(a.amountMinor).toBe(500_000);
  });

  it('upload → admin approves → access is granted at once, with one receipt', async () => {
    const ctx = setup();
    const paymentId = await payWithProof(ctx);
    expect((await ctx.get(`/api/payments/${paymentId}`)).json()).toMatchObject({ status: 'pending', proof: 'submitted' });
    expect(ctx.counts()).toEqual({ entitlements: 0, receipts: 0 });

    const r = await ctx.post(`/api/admin/payments/${paymentId}/decision`, { decision: 'approve' }, admin);
    expect(r.json()).toEqual({ outcome: 'granted', status: 'paid' });
    expect((await ctx.get(`/api/payments/${paymentId}`)).json()).toMatchObject({ status: 'paid', proof: 'approved' });
    expect((await ctx.get('/api/entitlements?userId=u1')).json().entitlements).toHaveLength(1);
    const receipts = (await ctx.get('/api/receipts?userId=u1')).json().receipts;
    expect(receipts).toHaveLength(1);
    expect(receipts[0]).toMatchObject({ amountMinor: 500_000, provider: 'manual' });
  });

  it('approving twice (double click, two admins) grants once', async () => {
    const ctx = setup();
    const paymentId = await payWithProof(ctx);
    const url = `/api/admin/payments/${paymentId}/decision`;
    const results = await Promise.all(Array.from({ length: 5 }, () => ctx.post(url, { decision: 'approve' }, admin)));
    expect(results.filter((r) => r.json().outcome === 'granted')).toHaveLength(1);
    expect(results.filter((r) => r.json().outcome === 'duplicate')).toHaveLength(4);
    expect(ctx.counts()).toEqual({ entitlements: 1, receipts: 1 });
  });

  it('reject → failed with note; a later approve does not grant; the player can start a new payment', async () => {
    const ctx = setup();
    const paymentId = await payWithProof(ctx);
    const url = `/api/admin/payments/${paymentId}/decision`;
    expect((await ctx.post(url, { decision: 'reject', note: "Chek o'qilmaydi" }, admin)).json()).toEqual({ outcome: 'failed', status: 'failed' });
    expect((await ctx.get(`/api/payments/${paymentId}`)).json()).toEqual({ status: 'failed', proof: 'rejected', note: "Chek o'qilmaydi", reason: null });
    expect((await ctx.post(url, { decision: 'approve' }, admin)).json().outcome).toBe('ignored');
    expect(ctx.counts()).toEqual({ entitlements: 0, receipts: 0 });
    const next = (await ctx.post('/api/payments', { userId: 'u1', product: 'persona_slot' })).json();
    expect(next.paymentId).not.toBe(paymentId);
  });

  it('validates the receipt image and its owner', async () => {
    const ctx = setup();
    const { paymentId } = (await ctx.post('/api/payments', { userId: 'u1', product: 'persona_slot' })).json();
    const url = `/api/payments/${paymentId}/proof`;
    expect((await ctx.post(url, { userId: 'someone-else', dataUrl: PNG })).statusCode).toBe(404);
    expect((await ctx.post(url, { userId: 'u1', dataUrl: 'data:text/html;base64,PGI+' })).statusCode).toBe(400);
    expect((await ctx.post(url, { userId: 'u1', dataUrl: 'data:image/png;base64,PGI+aGk8L2I+' })).statusCode).toBe(400); // not really a PNG
    expect((await ctx.post(url, { userId: 'u1' })).statusCode).toBe(400);
    expect((await ctx.post(url, { userId: 'u1', dataUrl: PNG })).statusCode).toBe(200);
    await ctx.post(`/api/admin/payments/${paymentId}/decision`, { decision: 'approve' }, admin);
    expect((await ctx.post(url, { userId: 'u1', dataUrl: PNG })).statusCode).toBe(409); // already decided
  });

  it('rejects oversized images', () => {
    const big = Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), Buffer.alloc(PROOF_MAX_BYTES)]).toString('base64');
    expect(parseProofDataUrl(`data:image/png;base64,${big}`)).toBeNull();
    expect(parseProofDataUrl(PNG)?.mime).toBe('image/png');
  });

  it('only the admin can list payments and see receipt images', async () => {
    const ctx = setup();
    await ctx.post('/api/users', { userId: 'u1', name: 'Aziz' });
    const paymentId = await payWithProof(ctx);
    expect((await ctx.get('/api/admin/payments')).statusCode).toBe(401);
    expect((await ctx.get(`/api/admin/payments/${paymentId}/proof`)).statusCode).toBe(401);
    const list = (await ctx.get('/api/admin/payments', admin)).json().payments;
    expect(list[0]).toMatchObject({ paymentId, userName: 'Aziz', status: 'pending', proof: { status: 'submitted' } });
    const img = await ctx.get(`/api/admin/payments/${paymentId}/proof`, admin);
    expect(img.statusCode).toBe(200);
    expect(img.headers['content-type']).toBe('image/png');
    expect(img.rawPayload.subarray(0, 4).toString('hex')).toBe('89504e47');
  });
});

describe('admin free access', () => {
  it('grants a slot without payment, leaves an audit trail, and does not stack unused slots', async () => {
    const ctx = setup();
    expect((await ctx.post('/api/admin/grant', { userId: 'owner' })).statusCode).toBe(401);
    const a = (await ctx.post('/api/admin/grant', { userId: 'owner' }, admin)).json().entitlement;
    const b = (await ctx.post('/api/admin/grant', { userId: 'owner' }, admin)).json().entitlement;
    expect(b.id).toBe(a.id);
    expect(ctx.counts()).toEqual({ entitlements: 1, receipts: 1 });
    const receipt = (await ctx.get('/api/receipts?userId=owner')).json().receipts[0];
    expect(receipt).toMatchObject({ amountMinor: 0, provider: 'admin' });

    // Once used, a new grant creates a new slot.
    await ctx.post(`/api/entitlements/${a.id}/consume`, { userId: 'owner', personaId: 'p1' });
    const c = (await ctx.post('/api/admin/grant', { userId: 'owner' }, admin)).json().entitlement;
    expect(c.id).not.toBe(a.id);
    expect(ctx.counts()).toEqual({ entitlements: 2, receipts: 2 });
  });
});

describe('fast receipt delivery', () => {
  it('config exposes the admin contact link', async () => {
    const { app } = buildApp({
      store: new JsonStore(null),
      provider: new ManualPaymentProvider('secret'),
      adminToken: TOKEN,
      contactUrl: 'https://t.me/futproadmin',
    });
    expect((await app.inject({ method: 'GET', url: '/api/config' })).json().contact).toBe('https://t.me/futproadmin');
  });
});

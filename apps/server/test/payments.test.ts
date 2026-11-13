import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from './helpers';
import { MockPaymentProvider, MOCK_SIGNATURE_HEADER } from '../src/payments/MockPaymentProvider';
import { InvalidWebhookError } from '../src/payments/PaymentProvider';
import { PaymentService } from '../src/payments/paymentService';
import { JsonStore } from '../src/store/jsonStore';
import { StoreDb } from '../src/store/storeDb';

const SECRET = 'test-secret';

function setup() {
  const store = new JsonStore(null);
  const provider = new MockPaymentProvider(SECRET);
  const service = new PaymentService(new StoreDb(store), provider);
  const counts = () =>
    store.read((db) => ({
      entitlements: Object.keys(db.entitlements).length,
      receipts: Object.keys(db.receipts).length,
    }));
  return { store, provider, service, counts };
}

describe('PaymentService idempotency', () => {
  let ctx: ReturnType<typeof setup>;
  beforeEach(() => {
    ctx = setup();
  });

  it('success webhook activates immediately and stores one receipt', async () => {
    const { payment } = await ctx.service.createPayment('u1', 'persona_slot');
    expect(payment.status).toBe('pending');
    const hook = await ctx.provider.simulateCheckout(payment.providerPaymentId, 'success');
    const r = await ctx.service.handleWebhook(hook.rawBody, hook.headers);
    expect(r.outcome).toBe('granted');
    // Immediate: no further step needed.
    expect(ctx.store.read((db) => db.payments[payment.id].status)).toBe('paid');
    expect(await ctx.service.entitlements('u1')).toHaveLength(1);
    const receipts = await ctx.service.receipts('u1');
    expect(receipts).toHaveLength(1);
    expect(receipts[0]).toMatchObject({ paymentId: payment.id, amountMinor: payment.amountMinor, currency: 'UZS', provider: 'mock' });
    expect(receipts[0].providerTxnId).toMatch(/^mocktxn_/);
  });

  it('the same event delivered twice grants access once', async () => {
    const { payment } = await ctx.service.createPayment('u1', 'persona_slot');
    const hook = await ctx.provider.simulateCheckout(payment.providerPaymentId, 'success');
    const first = await ctx.service.handleWebhook(hook.rawBody, hook.headers);
    const second = await ctx.service.handleWebhook(hook.rawBody, hook.headers);
    expect(first.outcome).toBe('granted');
    expect(second.outcome).toBe('duplicate');
    expect(ctx.counts()).toEqual({ entitlements: 1, receipts: 1 });
  });

  it('concurrent duplicate deliveries grant exactly once', async () => {
    const { payment } = await ctx.service.createPayment('u1', 'persona_slot');
    const hook = await ctx.provider.simulateCheckout(payment.providerPaymentId, 'success');
    const results = await Promise.all(Array.from({ length: 10 }, () => ctx.service.handleWebhook(hook.rawBody, hook.headers)));
    expect(results.filter((r) => r.outcome === 'granted')).toHaveLength(1);
    expect(results.filter((r) => r.outcome === 'duplicate')).toHaveLength(9);
    expect(ctx.counts()).toEqual({ entitlements: 1, receipts: 1 });
  });

  it('a second, different success event for the same payment does not grant again', async () => {
    const { payment } = await ctx.service.createPayment('u1', 'persona_slot');
    const a = await ctx.provider.simulateCheckout(payment.providerPaymentId, 'success');
    const b = await ctx.provider.simulateCheckout(payment.providerPaymentId, 'success'); // new eventId
    expect(JSON.parse(a.rawBody).eventId).not.toBe(JSON.parse(b.rawBody).eventId);
    expect((await ctx.service.handleWebhook(a.rawBody, a.headers)).outcome).toBe('granted');
    expect((await ctx.service.handleWebhook(b.rawBody, b.headers)).outcome).toBe('already_granted');
    expect(ctx.counts()).toEqual({ entitlements: 1, receipts: 1 });
  });

  it('rejects forged or tampered webhooks without changing state', async () => {
    const { payment } = await ctx.service.createPayment('u1', 'persona_slot');
    const hook = await ctx.provider.simulateCheckout(payment.providerPaymentId, 'success');
    const tampered = hook.rawBody.replace('payment.succeeded', 'payment.failed');
    await expect(ctx.service.handleWebhook(tampered, hook.headers)).rejects.toBeInstanceOf(InvalidWebhookError);
    await expect(ctx.service.handleWebhook(hook.rawBody, { [MOCK_SIGNATURE_HEADER]: 'ab'.repeat(32) })).rejects.toBeInstanceOf(InvalidWebhookError);
    await expect(ctx.service.handleWebhook(hook.rawBody, {})).rejects.toBeInstanceOf(InvalidWebhookError);
    expect(ctx.counts()).toEqual({ entitlements: 0, receipts: 0 });
    expect(ctx.store.read((db) => Object.keys(db.processedEvents))).toHaveLength(0);
  });

  it('amount mismatch does not grant', async () => {
    const { payment } = await ctx.service.createPayment('u1', 'persona_slot');
    const body = JSON.stringify({
      eventId: 'evt_x',
      type: 'payment.succeeded',
      providerPaymentId: payment.providerPaymentId,
      amountMinor: payment.amountMinor + 100,
      providerTxnId: 't1',
    });
    const r = await ctx.service.handleWebhook(body, { [MOCK_SIGNATURE_HEADER]: await ctx.provider.sign(body) });
    expect(r.outcome).toBe('amount_mismatch');
    expect(ctx.counts()).toEqual({ entitlements: 0, receipts: 0 });
  });

  it('failed payment grants nothing, and a later success event for it is ignored', async () => {
    const { payment } = await ctx.service.createPayment('u1', 'persona_slot');
    const fail = await ctx.provider.simulateCheckout(payment.providerPaymentId, 'fail');
    expect((await ctx.service.handleWebhook(fail.rawBody, fail.headers)).outcome).toBe('failed');
    expect(await ctx.service.getStatus(payment.id)).toBe('failed');
    const body = JSON.stringify({ eventId: 'evt_late', type: 'payment.succeeded', providerPaymentId: payment.providerPaymentId, amountMinor: payment.amountMinor, providerTxnId: 't' });
    expect((await ctx.service.handleWebhook(body, { [MOCK_SIGNATURE_HEADER]: await ctx.provider.sign(body) })).outcome).toBe('ignored');
    expect(ctx.counts()).toEqual({ entitlements: 0, receipts: 0 });
  });

  it('unknown payment is recorded but grants nothing', async () => {
    const body = JSON.stringify({ eventId: 'evt_u', type: 'payment.succeeded', providerPaymentId: 'mock_nope', amountMinor: 0, providerTxnId: 't' });
    expect((await ctx.service.handleWebhook(body, { [MOCK_SIGNATURE_HEADER]: await ctx.provider.sign(body) })).outcome).toBe('unknown_payment');
    expect(ctx.counts()).toEqual({ entitlements: 0, receipts: 0 });
  });

  it('status check reconciles a lost webhook, and the late webhook does not double-grant', async () => {
    const { payment } = await ctx.service.createPayment('u1', 'persona_slot');
    const hook = await ctx.provider.simulateCheckout(payment.providerPaymentId, 'success'); // webhook "lost"
    expect(await ctx.service.getStatus(payment.id)).toBe('paid');
    expect(await ctx.service.getStatus(payment.id)).toBe('paid');
    expect(ctx.counts()).toEqual({ entitlements: 1, receipts: 1 });
    expect((await ctx.service.handleWebhook(hook.rawBody, hook.headers)).outcome).toBe('already_granted');
    expect(ctx.counts()).toEqual({ entitlements: 1, receipts: 1 });
  });

  it('a persona slot is consumed once; same persona is idempotent; others are refused', async () => {
    const { payment } = await ctx.service.createPayment('u1', 'persona_slot');
    const hook = await ctx.provider.simulateCheckout(payment.providerPaymentId, 'success');
    await ctx.service.handleWebhook(hook.rawBody, hook.headers);
    const ent = (await ctx.service.entitlements('u1'))[0];
    expect((await ctx.service.consume(ent.id, 'u1', 'persona-A')).ok).toBe(true);
    expect((await ctx.service.consume(ent.id, 'u1', 'persona-A')).ok).toBe(true);
    expect((await ctx.service.consume(ent.id, 'u1', 'persona-B'))).toEqual({ ok: false, code: 409 });
    expect((await ctx.service.consume(ent.id, 'u2', 'persona-A'))).toEqual({ ok: false, code: 404 });
  });
});

describe('HTTP payment flow', () => {
  it('create → mock checkout → paid → entitlement + receipt; replayed webhook over HTTP is a no-op', async () => {
    const store = new JsonStore(null);
    const provider = new MockPaymentProvider(SECRET);
    const { app } = buildApp({ store, provider, adminToken: null });
    const created = await app.inject({ method: 'POST', url: '/api/payments', payload: { userId: 'u9', product: 'persona_slot' } });
    expect(created.statusCode).toBe(200);
    const { paymentId } = created.json();
    expect((await app.inject({ method: 'GET', url: `/api/payments/${paymentId}` })).json().status).toBe('pending');

    // Capture a webhook and replay it to the public endpoint.
    const payment = store.read((db) => db.payments[paymentId]);
    const hook = await provider.simulateCheckout(payment.providerPaymentId, 'success');
    const w1 = await app.inject({ method: 'POST', url: '/api/webhooks/mock', headers: hook.headers, payload: hook.rawBody });
    const w2 = await app.inject({ method: 'POST', url: '/api/webhooks/mock', headers: hook.headers, payload: hook.rawBody });
    expect(w1.json().outcome).toBe('granted');
    expect(w2.statusCode).toBe(200);
    expect(w2.json().outcome).toBe('duplicate');

    expect((await app.inject({ method: 'GET', url: `/api/payments/${paymentId}` })).json().status).toBe('paid');
    expect((await app.inject({ method: 'GET', url: '/api/entitlements?userId=u9' })).json().entitlements).toHaveLength(1);
    expect((await app.inject({ method: 'GET', url: '/api/receipts?userId=u9' })).json().receipts).toHaveLength(1);

    const forged = await app.inject({ method: 'POST', url: '/api/webhooks/mock', headers: { 'content-type': 'application/json', [MOCK_SIGNATURE_HEADER]: '00' }, payload: hook.rawBody });
    expect(forged.statusCode).toBe(401);
    await app.close();
  });

  it('mock checkout endpoint drives the webhook path', async () => {
    const { app } = buildApp({ store: new JsonStore(null), provider: new MockPaymentProvider(SECRET), adminToken: null });
    const { paymentId } = (await app.inject({ method: 'POST', url: '/api/payments', payload: { userId: 'u1', product: 'persona_slot' } })).json();
    expect((await app.inject({ method: 'POST', url: `/api/mock-checkout/${paymentId}`, payload: { outcome: 'success' } })).statusCode).toBe(200);
    expect((await app.inject({ method: 'POST', url: `/api/mock-checkout/${paymentId}`, payload: { outcome: 'success' } })).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: `/api/payments/${paymentId}` })).json().status).toBe('paid');
    expect((await app.inject({ method: 'GET', url: '/api/receipts?userId=u1' })).json().receipts).toHaveLength(1);
    await app.close();
  });

  it('validates input', async () => {
    const { app } = buildApp({ store: new JsonStore(null), provider: new MockPaymentProvider(SECRET), adminToken: null });
    expect((await app.inject({ method: 'POST', url: '/api/payments', payload: { product: 'persona_slot' } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: '/api/payments', payload: { userId: 'u', product: 'gold' } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'GET', url: '/api/payments/nope' })).statusCode).toBe(404);
    await app.close();
  });
});

describe('JsonStore persistence', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'futbolchi-'));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('survives a restart, and processed events stay deduplicated', async () => {
    const file = join(dir, 'db.json');
    const provider = new MockPaymentProvider(SECRET);
    const s1 = new PaymentService(new StoreDb(new JsonStore(file)), provider);
    const { payment } = await s1.createPayment('u1', 'persona_slot');
    const hook = await provider.simulateCheckout(payment.providerPaymentId, 'success');
    await s1.handleWebhook(hook.rawBody, hook.headers);

    const s2 = new PaymentService(new StoreDb(new JsonStore(file)), provider); // "restart"
    expect((await s2.handleWebhook(hook.rawBody, hook.headers)).outcome).toBe('duplicate');
    expect(await s2.entitlements('u1')).toHaveLength(1);
    expect(await s2.receipts('u1')).toHaveLength(1);
  });
});

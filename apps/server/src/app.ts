import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import type { GameState, MatchEvent } from '@futbolchi/engine';
import { PRODUCTS, type ProductId } from './domain';
import { InvalidWebhookError, type PaymentProvider } from './payments/PaymentProvider';
import { ManualPaymentProvider } from './payments/ManualPaymentProvider';
import { MockPaymentProvider } from './payments/MockPaymentProvider';
import { PaymentService } from './payments/paymentService';
import type { JsonStore } from './store/jsonStore';
import { MemoryProofStorage, parseProofDataUrl, type ProofStorage } from './store/proofStorage';

export interface PaymentCard {
  /** Card the player transfers to (manual payments). */
  number: string;
  holder: string;
}

export interface AppOptions {
  store: JsonStore;
  provider: PaymentProvider;
  /** Admin routes are disabled when null. */
  adminToken: string | null;
  /** Where receipt images go. Defaults to memory (tests). */
  proofs?: ProofStorage;
  /** Shown to players on the payment page. */
  paymentCard?: PaymentCard | null;
  logger?: boolean;
}

declare module 'fastify' {
  interface FastifyRequest {
    rawBody?: string;
  }
}

const isString = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 200;
export const USER_NAME_MIN = 2;
export const USER_NAME_MAX = 24;

export function buildApp(opts: AppOptions): { app: FastifyInstance; payments: PaymentService } {
  const app = Fastify({ logger: opts.logger ?? false, bodyLimit: 8 * 1024 * 1024 });
  const payments = new PaymentService(opts.store, opts.provider);
  const proofs = opts.proofs ?? new MemoryProofStorage();
  const now = () => new Date().toISOString();

  // Keep the raw body: webhook signatures are computed over the exact bytes.
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
    const raw = body as string;
    (req as FastifyRequest).rawBody = raw;
    try {
      done(null, raw.length ? JSON.parse(raw) : {});
    } catch (err) {
      done(err as Error, undefined);
    }
  });

  // ---------- Public info ----------
  /** Shown on the loading screen. */
  app.get('/api/stats', async () => ({ registered: opts.store.read((db) => Object.keys(db.users).length) }));

  app.get('/api/config', async () => ({
    provider: opts.provider.name,
    product: PRODUCTS.persona_slot,
    card: opts.provider.name === 'manual' ? (opts.paymentCard ?? null) : null,
  }));

  app.get<{ Params: { id: string } }>('/api/products/:id', async (req, reply) => {
    const p = PRODUCTS[req.params.id as ProductId];
    if (!p) return reply.code(404).send({ error: 'not_found' });
    return { product: p.id, amountMinor: p.amountMinor, currency: p.currency };
  });

  // ---------- Users ----------
  app.post<{ Body: { userId?: unknown; name?: unknown } }>('/api/users', async (req, reply) => {
    const { userId, name } = req.body ?? {};
    const clean = typeof name === 'string' ? name.trim() : '';
    if (!isString(userId) || clean.length < USER_NAME_MIN || clean.length > USER_NAME_MAX) {
      return reply.code(400).send({ error: 'bad_request' });
    }
    const user = opts.store.transaction((db) => {
      const existing = db.users[userId];
      db.users[userId] = { id: userId, name: clean, createdAt: existing?.createdAt ?? now() };
      return db.users[userId];
    });
    return { user };
  });

  // ---------- Payments ----------
  app.post<{ Body: { userId?: unknown; product?: unknown } }>('/api/payments', async (req, reply) => {
    const { userId, product } = req.body ?? {};
    if (!isString(userId) || !isString(product) || !(product in PRODUCTS)) return reply.code(400).send({ error: 'bad_request' });
    const { payment, checkoutUrl } = await payments.createPayment(userId, product as ProductId);
    return { paymentId: payment.id, checkoutUrl, amountMinor: payment.amountMinor, currency: payment.currency };
  });

  app.get<{ Params: { id: string } }>('/api/payments/:id', async (req, reply) => {
    const status = await payments.getStatus(req.params.id);
    if (!status) return reply.code(404).send({ error: 'not_found' });
    const proof = opts.store.read((db) => db.proofs[req.params.id]);
    return { status, proof: proof?.status ?? null, note: proof?.note ?? null };
  });

  /** Player uploads the receipt image ("chek") for a manual payment. Re-upload is allowed while pending. */
  app.post<{ Params: { id: string }; Body: { userId?: unknown; dataUrl?: unknown } }>('/api/payments/:id/proof', async (req, reply) => {
    const { userId, dataUrl } = req.body ?? {};
    const payment = opts.store.read((db) => db.payments[req.params.id]);
    if (!payment || !isString(userId) || payment.userId !== userId) return reply.code(404).send({ error: 'not_found' });
    if (payment.status !== 'pending') return reply.code(409).send({ error: 'not_pending' });
    const parsed = parseProofDataUrl(dataUrl);
    if (!parsed) return reply.code(400).send({ error: 'bad_image' });
    proofs.save(payment.id, parsed.mime, parsed.data);
    opts.store.transaction((db) => {
      db.proofs[payment.id] = {
        paymentId: payment.id,
        mime: parsed.mime,
        size: parsed.data.length,
        uploadedAt: now(),
        status: 'submitted',
      };
    });
    return { ok: true, proof: 'submitted' };
  });

  app.post<{ Params: { provider: string } }>('/api/webhooks/:provider', async (req, reply) => {
    if (req.params.provider !== opts.provider.name) return reply.code(404).send({ error: 'unknown_provider' });
    try {
      const result = await payments.handleWebhook(req.rawBody ?? '', req.headers);
      // Always 200 for authentic events (incl. duplicates) so the provider stops retrying.
      return { ok: true, ...result };
    } catch (err) {
      if (err instanceof InvalidWebhookError) return reply.code(401).send({ error: 'invalid_webhook' });
      throw err;
    }
  });

  // Mock checkout (tests): simulates the user paying and the provider delivering its webhook.
  if (opts.provider instanceof MockPaymentProvider) {
    const mock = opts.provider;
    app.post<{ Params: { paymentId: string }; Body: { outcome?: unknown } }>('/api/mock-checkout/:paymentId', async (req, reply) => {
      const payment = opts.store.read((db) => db.payments[req.params.paymentId]);
      if (!payment) return reply.code(404).send({ error: 'not_found' });
      const outcome = req.body?.outcome === 'fail' ? 'fail' : 'success';
      const hook = mock.simulateCheckout(payment.providerPaymentId, outcome);
      const res = await app.inject({ method: 'POST', url: '/api/webhooks/mock', headers: hook.headers, payload: hook.rawBody });
      return reply.code(res.statusCode).send({ ok: res.statusCode === 200 });
    });
  }

  // ---------- Entitlements & receipts ----------
  app.get<{ Querystring: { userId?: string } }>('/api/entitlements', async (req, reply) => {
    if (!isString(req.query.userId)) return reply.code(400).send({ error: 'bad_request' });
    return { entitlements: payments.entitlements(req.query.userId) };
  });

  app.post<{ Params: { id: string }; Body: { userId?: unknown; personaId?: unknown } }>('/api/entitlements/:id/consume', async (req, reply) => {
    const { userId, personaId } = req.body ?? {};
    if (!isString(userId) || !isString(personaId)) return reply.code(400).send({ error: 'bad_request' });
    const r = payments.consume(req.params.id, userId, personaId);
    if (!r.ok) return reply.code(r.code).send({ error: r.code === 404 ? 'not_found' : 'already_used' });
    return { entitlement: r.entitlement };
  });

  app.get<{ Querystring: { userId?: string } }>('/api/receipts', async (req, reply) => {
    if (!isString(req.query.userId)) return reply.code(400).send({ error: 'bad_request' });
    return { receipts: payments.receipts(req.query.userId) };
  });

  // ---------- Save sync (lets the admin see match events) ----------
  app.put<{ Params: { userId: string }; Body: GameState }>('/api/saves/:userId', async (req, reply) => {
    const state = req.body;
    if (!state || state.version !== 1 || typeof state.matches !== 'object') return reply.code(400).send({ error: 'bad_save' });
    opts.store.transaction((db) => {
      db.saves[req.params.userId] = { userId: req.params.userId, updatedAt: now(), state };
    });
    return { ok: true };
  });

  // ---------- Admin ----------
  app.register(async (admin) => {
    admin.addHook('onRequest', async (req, reply) => {
      if (!opts.adminToken) return reply.code(503).send({ error: 'admin_disabled' });
      if (req.headers['x-admin-token'] !== opts.adminToken) return reply.code(401).send({ error: 'unauthorized' });
    });

    /** Token check for the admin screen. */
    admin.get('/api/admin/ping', async () => ({ ok: true }));

    // --- Payments: review receipts, approve / reject, free access ---
    admin.get('/api/admin/payments', async () => {
      const rows = opts.store.read((db) =>
        Object.values(db.payments).map((p) => ({
          paymentId: p.id,
          userId: p.userId,
          userName: db.users[p.userId]?.name ?? null,
          amountMinor: p.amountMinor,
          provider: p.provider,
          status: p.status,
          createdAt: p.createdAt,
          proof: db.proofs[p.id] ? { status: db.proofs[p.id].status, uploadedAt: db.proofs[p.id].uploadedAt } : null,
        })),
      );
      // Waiting for review first, then newest.
      const waiting = (r: (typeof rows)[number]) => (r.status === 'pending' && r.proof?.status === 'submitted' ? 0 : 1);
      rows.sort((a, b) => waiting(a) - waiting(b) || b.createdAt.localeCompare(a.createdAt));
      return { payments: rows.slice(0, 200) };
    });

    admin.get<{ Params: { id: string } }>('/api/admin/payments/:id/proof', async (req, reply) => {
      const proof = opts.store.read((db) => db.proofs[req.params.id]);
      const data = proof ? proofs.read(proof.paymentId, proof.mime) : null;
      if (!proof || !data) return reply.code(404).send({ error: 'not_found' });
      return reply.header('content-type', proof.mime).header('cache-control', 'no-store').send(data);
    });

    admin.post<{ Params: { id: string }; Body: { decision?: unknown; note?: unknown } }>(
      '/api/admin/payments/:id/decision',
      async (req, reply) => {
        const decision = req.body?.decision;
        if (decision !== 'approve' && decision !== 'reject') return reply.code(400).send({ error: 'bad_request' });
        if (!(opts.provider instanceof ManualPaymentProvider)) return reply.code(409).send({ error: 'not_manual_provider' });
        const payment = opts.store.read((db) => db.payments[req.params.id]);
        if (!payment || payment.provider !== 'manual') return reply.code(404).send({ error: 'not_found' });
        // Same path as any provider webhook → same idempotency guarantees.
        const hook = opts.provider.decisionWebhook(payment, decision);
        const result = await payments.handleWebhook(hook.rawBody, hook.headers);
        const note = typeof req.body?.note === 'string' ? req.body.note.slice(0, 200) : undefined;
        const status = opts.store.transaction((db) => {
          const proof = db.proofs[payment.id];
          const final = db.payments[payment.id].status;
          if (proof && proof.status === 'submitted' && final !== 'pending') {
            proof.status = final === 'paid' ? 'approved' : 'rejected';
            proof.reviewedAt = now();
            if (note) proof.note = note;
          }
          return final;
        });
        return { outcome: result.outcome, status };
      },
    );

    /** Free persona slot without payment (for the owner/testers). */
    admin.post<{ Body: { userId?: unknown } }>('/api/admin/grant', async (req, reply) => {
      const userId = req.body?.userId;
      if (!isString(userId)) return reply.code(400).send({ error: 'bad_request' });
      return { entitlement: payments.adminGrant(userId, 'persona_slot') };
    });

    // --- Matches & highlights ---
    admin.get('/api/admin/matches', async () => {
      const matches = opts.store.read((db) =>
        Object.values(db.saves).flatMap((s) =>
          Object.values(s.state.matches).map((m) => ({
            matchId: m.id,
            userId: s.userId,
            week: m.week,
            seasonId: m.seasonId,
            home: s.state.clubs[m.homeId]?.name ?? m.homeId,
            away: s.state.clubs[m.awayId]?.name ?? m.awayId,
            score: m.score,
          })),
        ),
      );
      matches.sort((a, b) => b.seasonId.localeCompare(a.seasonId, undefined, { numeric: true }) || b.week - a.week);
      return { matches: matches.slice(0, 200) };
    });

    const findEvents = (userId: string, matchId: string): MatchEvent[] | null => {
      const m = opts.store.read((db) => db.saves[userId]?.state.matches[matchId]);
      if (!m) return null;
      const marked = new Set(opts.store.read((db) => db.highlights[`${userId}:${matchId}`] ?? []));
      return m.events.map((e) => ({ ...e, highlight: marked.has(e.id) }));
    };

    admin.get<{ Params: { matchId: string }; Querystring: { userId?: string } }>('/api/admin/matches/:matchId/events', async (req, reply) => {
      if (!isString(req.query.userId)) return reply.code(400).send({ error: 'bad_request' });
      const events = findEvents(req.query.userId, req.params.matchId);
      if (!events) return reply.code(404).send({ error: 'not_found' });
      return { events };
    });

    admin.post<{ Params: { matchId: string }; Body: { userId?: unknown; eventIds?: unknown } }>(
      '/api/admin/matches/:matchId/highlights',
      async (req, reply) => {
        const { userId, eventIds } = req.body ?? {};
        if (!isString(userId) || !Array.isArray(eventIds) || !eventIds.every(isString)) return reply.code(400).send({ error: 'bad_request' });
        const events = findEvents(userId, req.params.matchId);
        if (!events) return reply.code(404).send({ error: 'not_found' });
        const valid = new Set(events.map((e) => e.id));
        const unknown = (eventIds as string[]).filter((id) => !valid.has(id));
        if (unknown.length) return reply.code(400).send({ error: 'unknown_events', unknown });
        opts.store.transaction((db) => {
          db.highlights[`${userId}:${req.params.matchId}`] = [...new Set(eventIds as string[])];
        });
        return { events: findEvents(userId, req.params.matchId) };
      },
    );
  });

  return { app, payments };
}

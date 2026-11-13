/**
 * The HTTP API (Hono). Runtime-neutral: the same app runs
 *  - locally on Node (main.ts, JSON file store), and
 *  - in production as a Supabase Edge Function (supabase.ts, Postgres + Storage).
 * Every path starts with /api, as the game expects.
 */
import { Hono, type Context } from 'hono';
import type { GameState, MatchEvent } from '@futbolchi/engine';
import type { Db } from './db';
import { REJECT_REASONS, type ProductId, type RejectReason } from './domain';
import { parseProofDataUrl, sha256Hex } from './images';
import { InvalidWebhookError, type PaymentProvider } from './payments/PaymentProvider';
import { ManualPaymentProvider } from './payments/ManualPaymentProvider';
import { MockPaymentProvider } from './payments/MockPaymentProvider';
import { PaymentService } from './payments/paymentService';
import { AdminBot, type DecideResult, type TelegramApi, type TgUpdate } from './notify/telegram';

export interface PaymentCard {
  /** Card the player transfers to (manual payments). */
  number: string;
  holder: string;
}

export interface Logger {
  info(msg: string): void;
  warn(msg: string): void;
  error(msg: string): void;
}

export interface AppOptions {
  db: Db;
  provider: PaymentProvider;
  /** Admin routes are disabled when null. */
  adminToken: string | null;
  /** Persona price in tiyin (default 5 000 so'm). */
  priceMinor?: number;
  /** Shown to players on the payment page. */
  paymentCard?: PaymentCard | null;
  /** Where the game (web app) is served; opening the API root redirects there. */
  webUrl?: string | null;
  /**
   * Secret nickname that opens the admin login from the name screen. It only
   * reveals the login form; the admin token is still required. Null disables it.
   */
  adminNick?: string | null;
  /** Where players can message the admin (e.g. a Telegram link). Shown on the payment page. */
  contactUrl?: string | null;
  /**
   * Admin Telegram bot: every receipt arrives with approve / reject buttons.
   * chatId = TELEGRAM_CHAT_ID (more chats can link with the admin token).
   * webhook: production mode — Telegram calls POST /api/telegram/webhook.
   */
  telegram?: {
    api: TelegramApi;
    chatId: string | null;
    adminUrl: string | null;
    webhook?: { url: string; secret: string } | null;
  } | null;
  /** Sites allowed to call this API from the browser (CORS), e.g. the game on Vercel. */
  corsOrigins?: string[];
  logger?: Logger;
  /**
   * Keeps work alive after the response is sent (Supabase: EdgeRuntime.waitUntil).
   * Default: just let the promise run.
   */
  background?: (work: Promise<unknown>) => void;
}

const isString = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 200;
export const USER_NAME_MIN = 2;
export const USER_NAME_MAX = 24;
const BODY_LIMIT = 8 * 1024 * 1024;
const silent: Logger = { info: () => undefined, warn: () => undefined, error: () => undefined };

/** JSON body or {} (never throws). */
const body = async <T>(c: Context): Promise<Partial<T>> => {
  try {
    const v = await c.req.json();
    return v && typeof v === 'object' ? (v as Partial<T>) : {};
  } catch {
    return {};
  }
};

export function buildApp(opts: AppOptions): { app: Hono; payments: PaymentService; bot: AdminBot | null } {
  const app = new Hono();
  const db = opts.db;
  const log = opts.logger ?? silent;
  const payments = new PaymentService(db, opts.provider, opts.priceMinor);
  const now = () => new Date().toISOString();
  const background = (work: Promise<unknown>) => {
    const safe = work.catch((err: unknown) => log.warn(`[background] ${String(err)}`));
    if (opts.background) opts.background(safe);
  };

  /**
   * Approve or reject a manual payment (admin panel and Telegram bot).
   * Goes through the signed webhook path, so a double decision grants once.
   */
  async function decide(paymentId: string, decision: 'approve' | 'reject', extra: { note?: string; reason?: RejectReason; by?: string } = {}) {
    if (!(opts.provider instanceof ManualPaymentProvider)) return { error: 'not_manual_provider' as const, code: 409 as const };
    const payment = await db.getPayment(paymentId);
    if (!payment || payment.provider !== 'manual') return { error: 'not_found' as const, code: 404 as const };
    const hook = await opts.provider.decisionWebhook(payment, decision);
    const result = await payments.handleWebhook(hook.rawBody, hook.headers);
    const status = (await db.getPayment(paymentId))?.status ?? payment.status;
    const changed =
      status !== 'pending' &&
      (await db.closeProof(paymentId, {
        status: status === 'paid' ? 'approved' : 'rejected',
        reviewedAt: now(),
        note: extra.note,
        reason: status === 'failed' ? extra.reason : undefined,
        reviewedBy: extra.by?.slice(0, 64),
      }));
    // Update the Telegram messages about this receipt (drop their buttons).
    if (changed && bot) background(bot.decided(paymentId));
    return { outcome: result.outcome, status, changed };
  }

  const bot = opts.telegram
    ? new AdminBot({
        api: opts.telegram.api,
        db,
        adminToken: opts.adminToken,
        chatId: opts.telegram.chatId,
        adminUrl: opts.telegram.adminUrl,
        decide: async (id, decision, reason, by): Promise<DecideResult> => {
          const r = await decide(id, decision, { reason, by });
          return 'error' in r ? 'not_found' : r.changed ? 'ok' : 'already';
        },
        log,
      })
    : null;

  // ---------- Errors, limits, CORS ----------
  app.onError((err, c) => {
    log.error(`[api] ${c.req.method} ${c.req.path}: ${err instanceof Error ? err.stack ?? err.message : String(err)}`);
    return c.json({ error: 'internal' }, 500);
  });
  app.notFound((c) => c.json({ error: 'not_found' }, 404));

  const allowedOrigins = new Set((opts.corsOrigins ?? []).map((o) => o.trim().replace(/\/+$/, '')).filter(Boolean));
  app.use('*', async (c, next) => {
    const len = Number(c.req.header('content-length') ?? 0);
    if (len > BODY_LIMIT) return c.json({ error: 'too_large' }, 413);
    const origin = c.req.header('origin');
    if (origin && allowedOrigins.has(origin)) {
      c.header('access-control-allow-origin', origin);
      c.header('vary', 'origin');
      c.header('access-control-allow-methods', 'GET, POST, PUT, OPTIONS');
      c.header('access-control-allow-headers', 'content-type, x-admin-token');
      c.header('access-control-max-age', '86400');
    }
    // Production bot: make sure Telegram knows where to send updates (once per instance).
    if (bot && opts.telegram?.webhook) background(bot.ensureWebhook(opts.telegram.webhook.url, opts.telegram.webhook.secret));
    if (c.req.method === 'OPTIONS') return c.body(null, 204);
    await next();
  });

  // ---------- Browser landing ----------
  // This is the API; the game lives on the web app. Send people there.
  app.get('/', (c) => (opts.webUrl ? c.redirect(opts.webUrl, 302) : c.json({ ok: true, service: 'futbolchi-api' })));
  app.get('/api', (c) => (opts.webUrl ? c.redirect(opts.webUrl, 302) : c.json({ ok: true, service: 'futbolchi-api' })));
  app.get('/favicon.ico', (c) => c.body(null, 204));

  // ---------- Public info ----------
  /** Shown on the loading screen. */
  app.get('/api/stats', async (c) => c.json({ registered: await db.countUsers() }));

  app.get('/api/config', (c) =>
    c.json({
      provider: opts.provider.name,
      product: payments.products.persona_slot,
      card: opts.provider.name === 'manual' ? (opts.paymentCard ?? null) : null,
      contact: opts.contactUrl ?? null,
    }),
  );

  app.get('/api/products/:id', (c) => {
    const p = payments.products[c.req.param('id') as ProductId];
    if (!p) return c.json({ error: 'not_found' }, 404);
    return c.json({ product: p.id, amountMinor: p.amountMinor, currency: p.currency });
  });

  // ---------- Users ----------
  app.post('/api/users', async (c) => {
    const { userId, name } = await body<{ userId: unknown; name: unknown }>(c);
    const clean = typeof name === 'string' ? name.trim() : '';
    if (!isString(userId) || clean.length < USER_NAME_MIN || clean.length > USER_NAME_MAX) return c.json({ error: 'bad_request' }, 400);
    // The secret nickname is never registered as a player name.
    if (opts.adminNick && opts.adminToken && clean.toLowerCase() === opts.adminNick.toLowerCase()) return c.json({ admin: true });
    return c.json({ user: await db.upsertUser(userId, clean, now()) });
  });

  // ---------- Payments ----------
  app.post('/api/payments', async (c) => {
    const { userId, product } = await body<{ userId: unknown; product: unknown }>(c);
    if (!isString(userId) || !isString(product) || !(product in payments.products)) return c.json({ error: 'bad_request' }, 400);
    const { payment, checkoutUrl } = await payments.createPayment(userId, product as ProductId);
    return c.json({ paymentId: payment.id, checkoutUrl, amountMinor: payment.amountMinor, currency: payment.currency });
  });

  app.get('/api/payments/:id', async (c) => {
    const id = c.req.param('id');
    const status = await payments.getStatus(id);
    if (!status) return c.json({ error: 'not_found' }, 404);
    const proof = await db.getProof(id);
    return c.json({ status, proof: proof?.status ?? null, note: proof?.note ?? null, reason: proof?.reason ?? null });
  });

  /** Player uploads the receipt image ("chek") for a manual payment. Re-upload is allowed while pending. */
  app.post('/api/payments/:id/proof', async (c) => {
    const { userId, dataUrl } = await body<{ userId: unknown; dataUrl: unknown }>(c);
    const payment = await db.getPayment(c.req.param('id'));
    if (!payment || !isString(userId) || payment.userId !== userId) return c.json({ error: 'not_found' }, 404);
    if (payment.status !== 'pending') return c.json({ error: 'not_pending' }, 409);
    const parsed = parseProofDataUrl(dataUrl);
    if (!parsed) return c.json({ error: 'bad_image' }, 400);
    await db.saveImage(payment.id, parsed.mime, parsed.data);
    await db.putProof({
      paymentId: payment.id,
      mime: parsed.mime,
      size: parsed.data.length,
      uploadedAt: now(),
      status: 'submitted',
      sha256: await sha256Hex(parsed.data),
    });
    // Send it to the admin's Telegram right away. Never blocks or fails the upload.
    if (bot) background(bot.proofSubmitted({ paymentId: payment.id, mime: parsed.mime, data: parsed.data }));
    return c.json({ ok: true, proof: 'submitted' });
  });

  app.post('/api/webhooks/:provider', async (c) => {
    if (c.req.param('provider') !== opts.provider.name) return c.json({ error: 'unknown_provider' }, 404);
    const raw = await c.req.text();
    try {
      const result = await payments.handleWebhook(raw, Object.fromEntries(c.req.raw.headers));
      // Always 200 for authentic events (incl. duplicates) so the provider stops retrying.
      return c.json({ ok: true, ...result });
    } catch (err) {
      if (err instanceof InvalidWebhookError) return c.json({ error: 'invalid_webhook' }, 401);
      throw err;
    }
  });

  // Mock checkout (tests): simulates the user paying and the provider delivering its webhook.
  if (opts.provider instanceof MockPaymentProvider) {
    const mock = opts.provider;
    app.post('/api/mock-checkout/:paymentId', async (c) => {
      const payment = await db.getPayment(c.req.param('paymentId'));
      if (!payment) return c.json({ error: 'not_found' }, 404);
      const { outcome } = await body<{ outcome: unknown }>(c);
      const hook = await mock.simulateCheckout(payment.providerPaymentId, outcome === 'fail' ? 'fail' : 'success');
      const res = await app.request('/api/webhooks/mock', { method: 'POST', headers: hook.headers, body: hook.rawBody });
      return c.json({ ok: res.status === 200 }, res.status === 200 ? 200 : 400);
    });
  }

  // ---------- Entitlements & receipts ----------
  app.get('/api/entitlements', async (c) => {
    const userId = c.req.query('userId');
    if (!isString(userId)) return c.json({ error: 'bad_request' }, 400);
    return c.json({ entitlements: await payments.entitlements(userId) });
  });

  app.post('/api/entitlements/:id/consume', async (c) => {
    const { userId, personaId } = await body<{ userId: unknown; personaId: unknown }>(c);
    if (!isString(userId) || !isString(personaId)) return c.json({ error: 'bad_request' }, 400);
    const r = await payments.consume(c.req.param('id'), userId, personaId);
    if ('code' in r) return c.json({ error: r.code === 404 ? 'not_found' : 'already_used' }, r.code);
    return c.json({ entitlement: r.entitlement });
  });

  app.get('/api/receipts', async (c) => {
    const userId = c.req.query('userId');
    if (!isString(userId)) return c.json({ error: 'bad_request' }, 400);
    return c.json({ receipts: await payments.receipts(userId) });
  });

  // ---------- Save sync (lets the admin see match events) ----------
  app.put('/api/saves/:userId', async (c) => {
    const state = (await body<GameState>(c)) as GameState;
    if (!state || state.version !== 1 || typeof state.matches !== 'object') return c.json({ error: 'bad_save' }, 400);
    await db.putSave(c.req.param('userId'), state, now());
    return c.json({ ok: true });
  });

  // ---------- Telegram webhook (production bot) ----------
  app.post('/api/telegram/webhook', async (c) => {
    const hook = opts.telegram?.webhook;
    if (!bot || !hook) return c.json({ error: 'not_found' }, 404);
    if (c.req.header('x-telegram-bot-api-secret-token') !== hook.secret) return c.json({ error: 'unauthorized' }, 401);
    const update = await body<TgUpdate>(c);
    await bot.handleUpdate(update as TgUpdate).catch((err: unknown) => log.warn(`[telegram] update failed: ${String(err)}`));
    return c.json({ ok: true });
  });

  // ---------- Admin ----------
  app.use('/api/admin/*', async (c, next) => {
    if (!opts.adminToken) return c.json({ error: 'admin_disabled' }, 503);
    if (c.req.header('x-admin-token') !== opts.adminToken) return c.json({ error: 'unauthorized' }, 401);
    await next();
  });

  /** Token check for the admin screen. */
  app.get('/api/admin/ping', (c) => c.json({ ok: true }));

  // --- Payments: review receipts, approve / reject, free access ---
  app.get('/api/admin/payments', async (c) => {
    const list = await db.listPayments(500);
    const proofs = new Map((await db.getProofs(list.map((p) => p.id))).map((p) => [p.paymentId, p]));
    const names = new Map((await db.getUsers([...new Set(list.map((p) => p.userId))])).map((u) => [u.id, u.name]));
    const rows = list.map((p) => {
      const proof = proofs.get(p.id);
      return {
        paymentId: p.id,
        userId: p.userId,
        userName: names.get(p.userId) ?? null,
        amountMinor: p.amountMinor,
        provider: p.provider,
        status: p.status,
        createdAt: p.createdAt,
        proof: proof ? { status: proof.status, uploadedAt: proof.uploadedAt } : null,
      };
    });
    // Waiting for review first, then newest.
    const waiting = (r: (typeof rows)[number]) => (r.status === 'pending' && r.proof?.status === 'submitted' ? 0 : 1);
    rows.sort((a, b) => waiting(a) - waiting(b) || b.createdAt.localeCompare(a.createdAt));
    return c.json({ payments: rows.slice(0, 200) });
  });

  app.get('/api/admin/payments/:id/proof', async (c) => {
    const proof = await db.getProof(c.req.param('id'));
    const data = proof ? await db.readImage(proof.paymentId, proof.mime) : null;
    if (!proof || !data) return c.json({ error: 'not_found' }, 404);
    return c.body(new Uint8Array(data), 200, { 'content-type': proof.mime, 'cache-control': 'no-store' });
  });

  app.post('/api/admin/payments/:id/decision', async (c) => {
    const b = await body<{ decision: unknown; note: unknown; reason: unknown }>(c);
    if (b.decision !== 'approve' && b.decision !== 'reject') return c.json({ error: 'bad_request' }, 400);
    const note = typeof b.note === 'string' ? b.note.trim().slice(0, 200) || undefined : undefined;
    const reason = REJECT_REASONS.find((r) => r === b.reason);
    const r = await decide(c.req.param('id'), b.decision, { note, reason });
    if ('error' in r) return c.json({ error: r.error }, r.code);
    return c.json({ outcome: r.outcome, status: r.status });
  });

  /** Free persona slot without payment (for the owner/testers). */
  app.post('/api/admin/grant', async (c) => {
    const { userId } = await body<{ userId: unknown }>(c);
    if (!isString(userId)) return c.json({ error: 'bad_request' }, 400);
    return c.json({ entitlement: await payments.adminGrant(userId, 'persona_slot') });
  });

  // --- Matches & highlights ---
  app.get('/api/admin/matches', async (c) => {
    const matches = (await db.listSaves()).flatMap((s) =>
      Object.values(s.state.matches).map((m) => ({
        matchId: m.id,
        userId: s.userId,
        week: m.week,
        seasonId: m.seasonId,
        home: s.state.clubs[m.homeId]?.name ?? m.homeId,
        away: s.state.clubs[m.awayId]?.name ?? m.awayId,
        score: m.score,
      })),
    );
    matches.sort((a, b) => b.seasonId.localeCompare(a.seasonId, undefined, { numeric: true }) || b.week - a.week);
    return c.json({ matches: matches.slice(0, 200) });
  });

  const findEvents = async (userId: string, matchId: string): Promise<MatchEvent[] | null> => {
    const m = (await db.getSave(userId))?.state.matches[matchId];
    if (!m) return null;
    const marked = new Set(await db.getHighlights(`${userId}:${matchId}`));
    return m.events.map((e) => ({ ...e, highlight: marked.has(e.id) }));
  };

  app.get('/api/admin/matches/:matchId/events', async (c) => {
    const userId = c.req.query('userId');
    if (!isString(userId)) return c.json({ error: 'bad_request' }, 400);
    const events = await findEvents(userId, c.req.param('matchId'));
    if (!events) return c.json({ error: 'not_found' }, 404);
    return c.json({ events });
  });

  app.post('/api/admin/matches/:matchId/highlights', async (c) => {
    const { userId, eventIds } = await body<{ userId: unknown; eventIds: unknown }>(c);
    if (!isString(userId) || !Array.isArray(eventIds) || !eventIds.every(isString)) return c.json({ error: 'bad_request' }, 400);
    const matchId = c.req.param('matchId');
    const events = await findEvents(userId, matchId);
    if (!events) return c.json({ error: 'not_found' }, 404);
    const valid = new Set(events.map((e) => e.id));
    const unknown = (eventIds as string[]).filter((id) => !valid.has(id));
    if (unknown.length) return c.json({ error: 'unknown_events', unknown }, 400);
    await db.setHighlights(`${userId}:${matchId}`, [...new Set(eventIds as string[])]);
    return c.json({ events: await findEvents(userId, matchId) });
  });

  return { app, payments, bot };
}

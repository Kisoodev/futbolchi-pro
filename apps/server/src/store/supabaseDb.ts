/**
 * Db over Supabase: Postgres tables through the REST API (PostgREST) and
 * receipt images in the private Storage bucket "proofs".
 * Schema: supabase/migrations/0001_init.sql. Uses the service role key, so it
 * must only run on the server (the Edge Function). Plain fetch, no SDK:
 * runtime-neutral and easy to fake in tests.
 *
 * The writes that must not happen twice map to atomic SQL:
 *  - insert-if-absent  → POST with "resolution=ignore-duplicates" (ON CONFLICT DO NOTHING)
 *  - update-if-status  → PATCH with a status filter (UPDATE … WHERE status = …)
 */
import type { GameState } from '@futbolchi/engine';
import type { Db, ProofDecision, ProofMime } from '../db';
import type {
  BotAdmin,
  BotLang,
  Entitlement,
  Payment,
  PaymentProof,
  ProcessedEvent,
  ProductId,
  ProviderName,
  Receipt,
  RejectReason,
  SaveRecord,
  User,
} from '../domain';
import { IMAGE_EXT } from '../images';

type Row = Record<string, unknown>;
type Fetch = typeof fetch;

export class SupabaseError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

const iso = (v: unknown): string => new Date(String(v)).toISOString();
const isoOrUndef = (v: unknown) => (v == null ? undefined : iso(v));
const strOrUndef = (v: unknown) => (v == null ? undefined : String(v));
/** PostgREST value quoting for filters like in.(…) and or=(…). */
const q = (v: string) => `"${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
const enc = encodeURIComponent;

// ----- row ↔ record -----
const toUser = (r: Row): User => ({ id: String(r.id), name: String(r.name), createdAt: iso(r.created_at) });
const toPayment = (r: Row): Payment => ({
  id: String(r.id),
  userId: String(r.user_id),
  product: r.product as ProductId,
  amountMinor: Number(r.amount_minor),
  currency: 'UZS',
  provider: r.provider as ProviderName,
  providerPaymentId: String(r.provider_payment_id),
  status: r.status as Payment['status'],
  checkoutUrl: String(r.checkout_url ?? ''),
  createdAt: iso(r.created_at),
  updatedAt: iso(r.updated_at),
});
const fromPayment = (p: Payment): Row => ({
  id: p.id,
  user_id: p.userId,
  product: p.product,
  amount_minor: p.amountMinor,
  currency: p.currency,
  provider: p.provider,
  provider_payment_id: p.providerPaymentId,
  status: p.status,
  checkout_url: p.checkoutUrl,
  created_at: p.createdAt,
  updated_at: p.updatedAt,
});
const toProof = (r: Row): PaymentProof => ({
  paymentId: String(r.payment_id),
  mime: r.mime as ProofMime,
  size: Number(r.size),
  uploadedAt: iso(r.uploaded_at),
  status: r.status as PaymentProof['status'],
  reviewedAt: isoOrUndef(r.reviewed_at),
  note: strOrUndef(r.note),
  reason: strOrUndef(r.reason) as RejectReason | undefined,
  reviewedBy: strOrUndef(r.reviewed_by),
  sha256: strOrUndef(r.sha256),
});
const toEntitlement = (r: Row): Entitlement => ({
  id: String(r.id),
  userId: String(r.user_id),
  product: r.product as ProductId,
  paymentId: String(r.payment_id),
  grantedAt: iso(r.granted_at),
  consumedByPersonaId: r.consumed_by_persona_id == null ? null : String(r.consumed_by_persona_id),
});
const toReceipt = (r: Row): Receipt => ({
  id: String(r.id),
  paymentId: String(r.payment_id),
  userId: String(r.user_id),
  product: r.product as ProductId,
  amountMinor: Number(r.amount_minor),
  currency: 'UZS',
  provider: r.provider as ProviderName,
  providerTxnId: String(r.provider_txn_id),
  createdAt: iso(r.created_at),
});
const toSave = (r: Row): SaveRecord => ({ userId: String(r.user_id), updatedAt: iso(r.updated_at), state: r.state as GameState });
const toBotAdmin = (r: Row): BotAdmin => ({
  chatId: String(r.chat_id),
  lang: r.lang as BotLang,
  linkedAt: iso(r.linked_at),
  kind: (strOrUndef(r.kind) as BotAdmin['kind']) ?? undefined,
});

export class SupabaseDb implements Db {
  private readonly rest: string;
  private readonly storage: string;

  constructor(
    url: string,
    private readonly serviceKey: string,
    private readonly fetchFn: Fetch = fetch,
    private readonly bucket = 'proofs',
  ) {
    const base = url.replace(/\/+$/, '');
    this.rest = `${base}/rest/v1`;
    this.storage = `${base}/storage/v1`;
  }

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    return { apikey: this.serviceKey, authorization: `Bearer ${this.serviceKey}`, ...extra };
  }

  /** One PostgREST call. Returns parsed rows (or [] for empty bodies). */
  private async call(method: string, path: string, body?: unknown, prefer?: string): Promise<Row[]> {
    const res = await this.fetchFn(`${this.rest}/${path}`, {
      method,
      headers: this.headers({
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(prefer ? { prefer } : {}),
      }),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    if (!res.ok) throw new SupabaseError(res.status, `${method} ${path.split('?')[0]} → ${res.status} ${text.slice(0, 300)}`);
    if (!text) return [];
    const json = JSON.parse(text) as unknown;
    return Array.isArray(json) ? (json as Row[]) : [json as Row];
  }
  private select = (path: string) => this.call('GET', path);
  private first = async (path: string) => (await this.select(path))[0] ?? null;
  /** INSERT … ON CONFLICT DO NOTHING; true if a row was inserted. */
  private async insertIfAbsent(table: string, row: Row): Promise<boolean> {
    return (await this.call('POST', table, row, 'resolution=ignore-duplicates,return=representation')).length > 0;
  }
  private async upsert(table: string, row: Row, onConflict: string, columns?: string): Promise<Row[]> {
    const params = `on_conflict=${onConflict}${columns ? `&columns=${columns}` : ''}`;
    return this.call('POST', `${table}?${params}`, row, 'resolution=merge-duplicates,return=representation');
  }
  /** Batched "in" lookups (keeps URLs short). */
  private async selectIn(table: string, column: string, values: string[], extra = ''): Promise<Row[]> {
    const out: Row[] = [];
    for (let i = 0; i < values.length; i += 80) {
      const chunk = values.slice(i, i + 80);
      out.push(...(await this.select(`${table}?${column}=in.(${chunk.map((v) => enc(q(v))).join(',')})${extra}`)));
    }
    return out;
  }

  // ----- players -----
  async upsertUser(id: string, name: string): Promise<User> {
    // Only id and name are written: a new player gets created_at = now(), a rename keeps it.
    const [row] = await this.upsert('users', { id, name }, 'id', 'id,name');
    return toUser(row);
  }
  async getUser(id: string) {
    const r = await this.first(`users?id=eq.${enc(id)}&select=*`);
    return r ? toUser(r) : null;
  }
  async getUsers(ids: string[]) {
    return ids.length ? (await this.selectIn('users', 'id', ids, '&select=*')).map(toUser) : [];
  }
  async countUsers() {
    const res = await this.fetchFn(`${this.rest}/users?select=id`, { method: 'HEAD', headers: this.headers({ prefer: 'count=exact' }) });
    if (!res.ok) throw new SupabaseError(res.status, `count users → ${res.status}`);
    // Content-Range: "0-9/123" or "*/0"
    return Number(res.headers.get('content-range')?.split('/')[1] ?? 0) || 0;
  }

  // ----- payments -----
  async getPayment(id: string) {
    const r = await this.first(`payments?id=eq.${enc(id)}&select=*`);
    return r ? toPayment(r) : null;
  }
  async findPaymentByProvider(provider: ProviderName, providerPaymentId: string) {
    const r = await this.first(`payments?provider=eq.${enc(provider)}&provider_payment_id=eq.${enc(providerPaymentId)}&select=*`);
    return r ? toPayment(r) : null;
  }
  async findOpenPayment(userId: string, product: ProductId, provider: ProviderName) {
    const r = await this.first(
      `payments?user_id=eq.${enc(userId)}&product=eq.${enc(product)}&provider=eq.${enc(provider)}&status=eq.pending&order=created_at.desc&limit=1&select=*`,
    );
    return r ? toPayment(r) : null;
  }
  async insertPayment(p: Payment) {
    await this.call('POST', 'payments', fromPayment(p), 'return=minimal');
  }
  async settlePayment(id: string, status: 'paid' | 'failed', now: string) {
    const rows = await this.call('PATCH', `payments?id=eq.${enc(id)}&status=eq.pending`, { status, updated_at: now }, 'return=representation');
    return rows.length > 0;
  }
  async listPayments(limit: number) {
    return (await this.select(`payments?select=*&order=created_at.desc&limit=${limit}`)).map(toPayment);
  }
  async listPaymentsByUser(userId: string) {
    return (await this.select(`payments?user_id=eq.${enc(userId)}&select=*&order=created_at.desc`)).map(toPayment);
  }

  // ----- receipt images -----
  async getProof(paymentId: string) {
    const r = await this.first(`proofs?payment_id=eq.${enc(paymentId)}&select=*`);
    return r ? toProof(r) : null;
  }
  async getProofs(paymentIds: string[]) {
    return paymentIds.length ? (await this.selectIn('proofs', 'payment_id', paymentIds, '&select=*')).map(toProof) : [];
  }
  async putProof(p: PaymentProof) {
    await this.upsert(
      'proofs',
      {
        payment_id: p.paymentId,
        mime: p.mime,
        size: p.size,
        uploaded_at: p.uploadedAt,
        status: p.status,
        reviewed_at: p.reviewedAt ?? null,
        note: p.note ?? null,
        reason: p.reason ?? null,
        reviewed_by: p.reviewedBy ?? null,
        sha256: p.sha256 ?? null,
      },
      'payment_id',
    );
  }
  async closeProof(paymentId: string, d: ProofDecision) {
    const patch: Row = { status: d.status, reviewed_at: d.reviewedAt ?? new Date().toISOString() };
    if (d.note) patch.note = d.note;
    if (d.reason) patch.reason = d.reason;
    if (d.reviewedBy) patch.reviewed_by = d.reviewedBy;
    const rows = await this.call('PATCH', `proofs?payment_id=eq.${enc(paymentId)}&status=eq.submitted`, patch, 'return=representation');
    return rows.length > 0;
  }
  async findProofsBySha(sha256: string) {
    return (await this.select(`proofs?sha256=eq.${enc(sha256)}&select=*`)).map(toProof);
  }
  async listWaitingProofs() {
    const rows = await this.select('proofs?status=eq.submitted&select=*,payments!inner(status)&payments.status=eq.pending&order=uploaded_at.asc');
    return rows.map(toProof);
  }
  async addProofMessage(paymentId: string, chatId: string, messageId: number) {
    await this.insertIfAbsent('proof_messages', { payment_id: paymentId, chat_id: chatId, message_id: messageId });
  }
  async listProofMessages(paymentId: string) {
    return (await this.select(`proof_messages?payment_id=eq.${enc(paymentId)}&select=*`)).map((r) => ({
      chatId: String(r.chat_id),
      messageId: Number(r.message_id),
    }));
  }
  private objectPath(paymentId: string, mime: ProofMime) {
    return `${this.storage}/object/${this.bucket}/${enc(paymentId.replace(/[^A-Za-z0-9_-]/g, ''))}.${IMAGE_EXT[mime]}`;
  }
  async saveImage(paymentId: string, mime: ProofMime, data: Uint8Array) {
    const res = await this.fetchFn(this.objectPath(paymentId, mime), {
      method: 'POST',
      headers: this.headers({ 'content-type': mime, 'x-upsert': 'true', 'cache-control': 'no-store' }),
      body: new Uint8Array(data),
    });
    if (!res.ok) throw new SupabaseError(res.status, `upload receipt → ${res.status} ${(await res.text()).slice(0, 200)}`);
  }
  async readImage(paymentId: string, mime: ProofMime) {
    const res = await this.fetchFn(this.objectPath(paymentId, mime), { headers: this.headers() });
    if (res.status === 400 || res.status === 404) return null;
    if (!res.ok) throw new SupabaseError(res.status, `download receipt → ${res.status}`);
    return new Uint8Array(await res.arrayBuffer());
  }

  // ----- access and receipts -----
  async insertEntitlement(e: Entitlement) {
    return this.insertIfAbsent('entitlements', {
      id: e.id,
      user_id: e.userId,
      product: e.product,
      payment_id: e.paymentId,
      granted_at: e.grantedAt,
      consumed_by_persona_id: e.consumedByPersonaId,
    });
  }
  async getEntitlement(id: string) {
    const r = await this.first(`entitlements?id=eq.${enc(id)}&select=*`);
    return r ? toEntitlement(r) : null;
  }
  async listEntitlements(userId: string) {
    return (await this.select(`entitlements?user_id=eq.${enc(userId)}&select=*&order=granted_at.asc`)).map(toEntitlement);
  }
  async consumeEntitlement(id: string, userId: string, personaId: string) {
    const free = `or=(consumed_by_persona_id.is.null,consumed_by_persona_id.eq.${enc(q(personaId))})`;
    const rows = await this.call(
      'PATCH',
      `entitlements?id=eq.${enc(id)}&user_id=eq.${enc(userId)}&${free}`,
      { consumed_by_persona_id: personaId },
      'return=representation',
    );
    return rows[0] ? toEntitlement(rows[0]) : null;
  }
  async insertReceipt(r: Receipt) {
    return this.insertIfAbsent('receipts', {
      id: r.id,
      payment_id: r.paymentId,
      user_id: r.userId,
      product: r.product,
      amount_minor: r.amountMinor,
      currency: r.currency,
      provider: r.provider,
      provider_txn_id: r.providerTxnId,
      created_at: r.createdAt,
    });
  }
  async listReceipts(userId: string) {
    return (await this.select(`receipts?user_id=eq.${enc(userId)}&select=*&order=created_at.asc`)).map(toReceipt);
  }
  async insertProcessedEvent(e: ProcessedEvent) {
    return this.insertIfAbsent('processed_events', { key: e.key, payment_id: e.paymentId, result: e.result, received_at: e.receivedAt });
  }
  async setProcessedEventResult(key: string, result: ProcessedEvent['result'], paymentId: string | null) {
    await this.call('PATCH', `processed_events?key=eq.${enc(key)}`, { result, payment_id: paymentId }, 'return=minimal');
  }

  // ----- saves and highlights -----
  async putSave(userId: string, state: GameState, now: string) {
    await this.upsert('saves', { user_id: userId, updated_at: now, state }, 'user_id');
  }
  async getSave(userId: string) {
    const r = await this.first(`saves?user_id=eq.${enc(userId)}&select=*`);
    return r ? toSave(r) : null;
  }
  async listSaves() {
    return (await this.select('saves?select=*&order=updated_at.desc&limit=200')).map(toSave);
  }
  async getHighlights(key: string) {
    const r = await this.first(`highlights?key=eq.${enc(key)}&select=*`);
    return Array.isArray(r?.event_ids) ? (r.event_ids as string[]) : [];
  }
  async setHighlights(key: string, eventIds: string[]) {
    await this.upsert('highlights', { key, event_ids: eventIds }, 'key');
  }

  // ----- Telegram bot -----
  async listBotAdmins() {
    return (await this.select('bot_admins?select=*&order=linked_at.asc')).map(toBotAdmin);
  }
  async putBotAdmin(a: BotAdmin) {
    await this.upsert('bot_admins', { chat_id: a.chatId, lang: a.lang, linked_at: a.linkedAt, kind: a.kind ?? null }, 'chat_id');
  }
  async deleteBotAdmin(chatId: string) {
    return (await this.call('DELETE', `bot_admins?chat_id=eq.${enc(chatId)}`, undefined, 'return=representation')).length > 0;
  }
  async getMeta(key: string) {
    const r = await this.first(`meta?key=eq.${enc(key)}&select=value`);
    return r ? String(r.value) : null;
  }
  async setMeta(key: string, value: string) {
    await this.upsert('meta', { key, value }, 'key');
  }
}

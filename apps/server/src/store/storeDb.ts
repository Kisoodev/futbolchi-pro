/**
 * Db over the JSON file store (local dev and tests). Each method runs in one
 * synchronous JsonStore transaction, so the conditional writes are atomic.
 * Reads return copies, like a real database would.
 */
import type { GameState } from '@futbolchi/engine';
import type { Db, ProofDecision, ProofMime } from '../db';
import type { BotAdmin, DbShape, Entitlement, Payment, PaymentProof, ProcessedEvent, ProductId, ProviderName, Receipt, SaveRecord } from '../domain';
import type { JsonStore } from './jsonStore';
import { MemoryProofStorage, type ProofStorage } from './proofStorage';

const clone = <T>(v: T): T => (v === undefined ? v : (JSON.parse(JSON.stringify(v)) as T));
const byNewest = (a: { createdAt: string }, b: { createdAt: string }) => b.createdAt.localeCompare(a.createdAt);

export class StoreDb implements Db {
  constructor(
    readonly store: JsonStore,
    private readonly images: ProofStorage = new MemoryProofStorage(),
  ) {}

  private read<T>(fn: (db: Readonly<DbShape>) => T): T {
    return clone(this.store.read(fn));
  }

  // ----- players -----
  async upsertUser(id: string, name: string, now: string) {
    return clone(
      this.store.transaction((db) => {
        db.users[id] = { id, name, createdAt: db.users[id]?.createdAt ?? now };
        return db.users[id];
      }),
    );
  }
  async getUser(id: string) {
    return this.read((db) => db.users[id] ?? null);
  }
  async getUsers(ids: string[]) {
    return this.read((db) => ids.map((id) => db.users[id]).filter((u): u is NonNullable<typeof u> => !!u));
  }
  async countUsers() {
    return this.store.read((db) => Object.keys(db.users).length);
  }

  // ----- payments -----
  async getPayment(id: string) {
    return this.read((db) => db.payments[id] ?? null);
  }
  async findPaymentByProvider(provider: ProviderName, providerPaymentId: string) {
    return this.read((db) => Object.values(db.payments).find((p) => p.provider === provider && p.providerPaymentId === providerPaymentId) ?? null);
  }
  async findOpenPayment(userId: string, product: ProductId, provider: ProviderName) {
    return this.read(
      (db) =>
        Object.values(db.payments).find((p) => p.userId === userId && p.product === product && p.provider === provider && p.status === 'pending') ??
        null,
    );
  }
  async insertPayment(p: Payment) {
    this.store.transaction((db) => {
      db.payments[p.id] = clone(p);
    });
  }
  async settlePayment(id: string, status: 'paid' | 'failed', now: string) {
    return this.store.transaction((db) => {
      const p = db.payments[id];
      if (!p || p.status !== 'pending') return false;
      p.status = status;
      p.updatedAt = now;
      return true;
    });
  }
  async listPayments(limit: number) {
    return this.read((db) => Object.values(db.payments).sort(byNewest).slice(0, limit));
  }
  async listPaymentsByUser(userId: string) {
    return this.read((db) => Object.values(db.payments).filter((p) => p.userId === userId).sort(byNewest));
  }

  // ----- receipt images -----
  async getProof(paymentId: string) {
    return this.read((db) => db.proofs[paymentId] ?? null);
  }
  async getProofs(paymentIds: string[]) {
    return this.read((db) => paymentIds.map((id) => db.proofs[id]).filter((p): p is PaymentProof => !!p));
  }
  async putProof(p: PaymentProof) {
    this.store.transaction((db) => {
      db.proofs[p.paymentId] = clone(p);
    });
  }
  async closeProof(paymentId: string, d: ProofDecision) {
    return this.store.transaction((db) => {
      const proof = db.proofs[paymentId];
      if (!proof || proof.status !== 'submitted') return false;
      proof.status = d.status;
      proof.reviewedAt = d.reviewedAt;
      if (d.note) proof.note = d.note;
      if (d.reason) proof.reason = d.reason;
      if (d.reviewedBy) proof.reviewedBy = d.reviewedBy;
      return true;
    });
  }
  async findProofsBySha(sha256: string) {
    return this.read((db) => Object.values(db.proofs).filter((p) => p.sha256 === sha256));
  }
  async listWaitingProofs() {
    return this.read((db) =>
      Object.values(db.proofs)
        .filter((p) => p.status === 'submitted' && db.payments[p.paymentId]?.status === 'pending')
        .sort((a, b) => a.uploadedAt.localeCompare(b.uploadedAt)),
    );
  }
  async addProofMessage(paymentId: string, chatId: string, messageId: number) {
    this.store.transaction((db) => {
      const proof = db.proofs[paymentId];
      if (proof) proof.telegram = [...(proof.telegram ?? []), { chatId, messageId }];
    });
  }
  async listProofMessages(paymentId: string) {
    return this.read((db) => db.proofs[paymentId]?.telegram ?? []);
  }
  async saveImage(paymentId: string, mime: ProofMime, data: Uint8Array) {
    this.images.save(paymentId, mime, data);
  }
  async readImage(paymentId: string, mime: ProofMime) {
    return this.images.read(paymentId, mime);
  }

  // ----- access and receipts -----
  async insertEntitlement(e: Entitlement) {
    return this.store.transaction((db) => {
      if (db.entitlements[e.id]) return false;
      db.entitlements[e.id] = clone(e);
      return true;
    });
  }
  async getEntitlement(id: string) {
    return this.read((db) => db.entitlements[id] ?? null);
  }
  async listEntitlements(userId: string) {
    return this.read((db) => Object.values(db.entitlements).filter((e) => e.userId === userId));
  }
  async consumeEntitlement(id: string, userId: string, personaId: string) {
    return clone(
      this.store.transaction((db) => {
        const e = db.entitlements[id];
        if (!e || e.userId !== userId) return null;
        if (e.consumedByPersonaId && e.consumedByPersonaId !== personaId) return null;
        e.consumedByPersonaId = personaId;
        return e;
      }),
    );
  }
  async insertReceipt(r: Receipt) {
    return this.store.transaction((db) => {
      if (db.receipts[r.id]) return false;
      db.receipts[r.id] = clone(r);
      return true;
    });
  }
  async listReceipts(userId: string) {
    return this.read((db) => Object.values(db.receipts).filter((r) => r.userId === userId));
  }
  async insertProcessedEvent(e: ProcessedEvent) {
    return this.store.transaction((db) => {
      if (db.processedEvents[e.key]) return false;
      db.processedEvents[e.key] = clone(e);
      return true;
    });
  }
  async setProcessedEventResult(key: string, result: ProcessedEvent['result'], paymentId: string | null) {
    this.store.transaction((db) => {
      const e = db.processedEvents[key];
      if (e) Object.assign(e, { result, paymentId });
    });
  }

  // ----- saves and highlights -----
  async putSave(userId: string, state: GameState, now: string) {
    this.store.transaction((db) => {
      db.saves[userId] = { userId, updatedAt: now, state };
    });
  }
  async getSave(userId: string) {
    return this.read((db) => db.saves[userId] ?? null);
  }
  async listSaves(): Promise<SaveRecord[]> {
    return this.read((db) => Object.values(db.saves));
  }
  async getHighlights(key: string) {
    return this.read((db) => db.highlights[key] ?? []);
  }
  async setHighlights(key: string, eventIds: string[]) {
    this.store.transaction((db) => {
      db.highlights[key] = [...eventIds];
    });
  }

  // ----- Telegram bot -----
  async listBotAdmins(): Promise<BotAdmin[]> {
    return this.read((db) => Object.values(db.telegram.admins));
  }
  async putBotAdmin(a: BotAdmin) {
    this.store.transaction((db) => {
      db.telegram.admins[a.chatId] = clone(a);
    });
  }
  async deleteBotAdmin(chatId: string) {
    return this.store.transaction((db) => {
      const had = !!db.telegram.admins[chatId];
      delete db.telegram.admins[chatId];
      return had;
    });
  }
  async getMeta(key: string) {
    if (key === 'telegram_offset') return this.store.read((db) => String(db.telegram.offset ?? 0));
    return this.store.read((db) => db.meta?.[key] ?? null);
  }
  async setMeta(key: string, value: string) {
    this.store.transaction((db) => {
      if (key === 'telegram_offset') db.telegram.offset = Number(value) || 0;
      else (db.meta ??= {})[key] = value;
    });
  }
}

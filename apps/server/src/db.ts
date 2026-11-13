/**
 * Storage used by the API, the payment logic and the Telegram bot.
 *
 * Two implementations:
 *  - StoreDb    (store/storeDb.ts)    local dev and tests: one JSON file + receipt images on disk
 *  - SupabaseDb (store/supabaseDb.ts) production: Supabase Postgres tables + Storage bucket
 *
 * Every write that must not happen twice is a conditional, atomic operation
 * (insert-if-absent, update-if-status), so concurrent requests stay safe on
 * Postgres just like they were inside one synchronous JSON transaction.
 */
import type { GameState } from '@futbolchi/engine';
import type {
  BotAdmin,
  Entitlement,
  Payment,
  PaymentProof,
  PaymentStatus,
  ProcessedEvent,
  ProductId,
  ProviderName,
  Receipt,
  SaveRecord,
  User,
} from './domain';

export type ProofMime = PaymentProof['mime'];
export type ProofDecision = Pick<PaymentProof, 'reviewedAt' | 'note' | 'reason' | 'reviewedBy'> & { status: 'approved' | 'rejected' };

export interface Db {
  // ----- players -----
  /** Creates or renames; keeps the first createdAt. */
  upsertUser(id: string, name: string, now: string): Promise<User>;
  getUser(id: string): Promise<User | null>;
  getUsers(ids: string[]): Promise<User[]>;
  countUsers(): Promise<number>;

  // ----- payments -----
  getPayment(id: string): Promise<Payment | null>;
  findPaymentByProvider(provider: ProviderName, providerPaymentId: string): Promise<Payment | null>;
  findOpenPayment(userId: string, product: ProductId, provider: ProviderName): Promise<Payment | null>;
  insertPayment(p: Payment): Promise<void>;
  /** pending → status. True only for the call that made the change. */
  settlePayment(id: string, status: Exclude<PaymentStatus, 'pending'>, now: string): Promise<boolean>;
  /** Newest first. */
  listPayments(limit: number): Promise<Payment[]>;
  listPaymentsByUser(userId: string): Promise<Payment[]>;

  // ----- receipt images ("chek") -----
  getProof(paymentId: string): Promise<PaymentProof | null>;
  getProofs(paymentIds: string[]): Promise<PaymentProof[]>;
  /** New upload (or a re-upload while pending): replaces the record. */
  putProof(p: PaymentProof): Promise<void>;
  /** submitted → approved | rejected. True only for the call that made the change. */
  closeProof(paymentId: string, decision: ProofDecision): Promise<boolean>;
  findProofsBySha(sha256: string): Promise<PaymentProof[]>;
  /** Submitted receipts whose payment is still pending, oldest first. */
  listWaitingProofs(): Promise<PaymentProof[]>;
  addProofMessage(paymentId: string, chatId: string, messageId: number): Promise<void>;
  listProofMessages(paymentId: string): Promise<{ chatId: string; messageId: number }[]>;
  saveImage(paymentId: string, mime: ProofMime, data: Uint8Array): Promise<void>;
  readImage(paymentId: string, mime: ProofMime): Promise<Uint8Array | null>;

  // ----- access and receipts -----
  /** False if an entitlement with this id already exists. */
  insertEntitlement(e: Entitlement): Promise<boolean>;
  getEntitlement(id: string): Promise<Entitlement | null>;
  listEntitlements(userId: string): Promise<Entitlement[]>;
  /** Marks the slot used by personaId if it is free or already this persona's. Null otherwise. */
  consumeEntitlement(id: string, userId: string, personaId: string): Promise<Entitlement | null>;
  /** False if a receipt with this id already exists. */
  insertReceipt(r: Receipt): Promise<boolean>;
  listReceipts(userId: string): Promise<Receipt[]>;
  /** False if this event key was seen before (webhook de-duplication). */
  insertProcessedEvent(e: ProcessedEvent): Promise<boolean>;
  setProcessedEventResult(key: string, result: ProcessedEvent['result'], paymentId: string | null): Promise<void>;

  // ----- game saves and highlights (admin tools) -----
  putSave(userId: string, state: GameState, now: string): Promise<void>;
  getSave(userId: string): Promise<SaveRecord | null>;
  listSaves(): Promise<SaveRecord[]>;
  getHighlights(key: string): Promise<string[]>;
  setHighlights(key: string, eventIds: string[]): Promise<void>;

  // ----- Telegram bot -----
  listBotAdmins(): Promise<BotAdmin[]>;
  putBotAdmin(a: BotAdmin): Promise<void>;
  /** True if it existed. */
  deleteBotAdmin(chatId: string): Promise<boolean>;
  getMeta(key: string): Promise<string | null>;
  setMeta(key: string, value: string): Promise<void>;
}

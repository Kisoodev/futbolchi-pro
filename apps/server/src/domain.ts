/** Server-side records. Plain JSON, stored by JsonStore. */
import type { GameState } from '@futbolchi/engine';

export type ProductId = 'persona_slot';
/** 'manual' = card transfer + receipt approved by an admin; 'admin' = free access granted by an admin. */
export type ProviderName = 'mock' | 'manual' | 'admin' | 'payme' | 'click';
export type PaymentStatus = 'pending' | 'paid' | 'failed';

export interface Product {
  id: ProductId;
  /** Minor units (tiyin). 1 so'm = 100 tiyin. */
  amountMinor: number;
  currency: 'UZS';
}

/** Persona price: 5 000 so'm. Override with PERSONA_PRICE_MINOR (in tiyin). */
export const PRODUCTS: Record<ProductId, Product> = {
  persona_slot: {
    id: 'persona_slot',
    amountMinor: Number(process.env.PERSONA_PRICE_MINOR ?? 500_000),
    currency: 'UZS',
  },
};

export interface Payment {
  id: string;
  userId: string;
  product: ProductId;
  amountMinor: number;
  currency: 'UZS';
  provider: ProviderName;
  providerPaymentId: string;
  status: PaymentStatus;
  checkoutUrl: string;
  createdAt: string;
  updatedAt: string;
}

/** A registered player (name entered on the main menu). No accounts yet: the id is the browser's anonymous id. */
export interface User {
  id: string;
  name: string;
  createdAt: string;
}

/** Why a receipt was rejected. Shown to the player in their own language. */
export const REJECT_REASONS = ['amount', 'unreadable', 'not_received', 'duplicate'] as const;
export type RejectReason = (typeof REJECT_REASONS)[number];

/** Uploaded receipt image for a manual payment. The file itself lives in ProofStorage. */
export interface PaymentProof {
  paymentId: string;
  mime: 'image/png' | 'image/jpeg' | 'image/webp';
  size: number;
  uploadedAt: string;
  status: 'submitted' | 'approved' | 'rejected';
  reviewedAt?: string;
  /** Free text from the admin panel. */
  note?: string;
  /** Who decided it in Telegram (shown in group chats). */
  reviewedBy?: string;
  /** Chosen reason (e.g. from the Telegram bot). */
  reason?: RejectReason;
  /** Image fingerprint: the same screenshot sent twice is flagged to the admin. */
  sha256?: string;
  /** Telegram messages showing this receipt, updated when it is decided. */
  telegram?: { chatId: string; messageId: number }[];
}

export type BotLang = 'uz' | 'en' | 'ru';

/**
 * Telegram chats allowed to review receipts: private chats linked with the
 * admin token, and groups linked with /link by such an admin.
 */
export interface BotAdmin {
  chatId: string;
  lang: BotLang;
  linkedAt: string;
  kind?: 'private' | 'group';
}

/** Access granted by a paid payment. Unique per paymentId. */
export interface Entitlement {
  id: string;
  userId: string;
  product: ProductId;
  paymentId: string;
  grantedAt: string;
  consumedByPersonaId: string | null;
}

/** Stored for every paid action. Unique per paymentId. */
export interface Receipt {
  id: string;
  paymentId: string;
  userId: string;
  product: ProductId;
  amountMinor: number;
  currency: 'UZS';
  provider: ProviderName;
  providerTxnId: string;
  createdAt: string;
}

/** Every webhook event we have handled, keyed by provider + eventId. */
export interface ProcessedEvent {
  key: string;
  paymentId: string | null;
  result: WebhookOutcome;
  receivedAt: string;
}

export type WebhookOutcome = 'granted' | 'already_granted' | 'failed' | 'ignored' | 'amount_mismatch' | 'unknown_payment';

export interface SaveRecord {
  userId: string;
  updatedAt: string;
  state: GameState;
}

export interface DbShape {
  users: Record<string, User>;
  /** key: paymentId */
  proofs: Record<string, PaymentProof>;
  payments: Record<string, Payment>;
  entitlements: Record<string, Entitlement>;
  receipts: Record<string, Receipt>;
  processedEvents: Record<string, ProcessedEvent>;
  saves: Record<string, SaveRecord>;
  /** key: `${userId}:${matchId}` → highlighted event ids */
  highlights: Record<string, string[]>;
  telegram: { admins: Record<string, BotAdmin>; offset: number };
}

export const emptyDb = (): DbShape => ({
  users: {},
  proofs: {},
  payments: {},
  entitlements: {},
  receipts: {},
  processedEvents: {},
  saves: {},
  highlights: {},
  telegram: { admins: {}, offset: 0 },
});

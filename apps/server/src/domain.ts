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

/** Uploaded receipt image for a manual payment. The file itself lives in ProofStorage. */
export interface PaymentProof {
  paymentId: string;
  mime: 'image/png' | 'image/jpeg' | 'image/webp';
  size: number;
  uploadedAt: string;
  status: 'submitted' | 'approved' | 'rejected';
  reviewedAt?: string;
  note?: string;
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
});

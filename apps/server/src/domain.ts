/** Server-side records. Plain JSON, stored by JsonStore. */
import type { GameState } from '@futbolchi/engine';

export type ProductId = 'persona_slot';
export type ProviderName = 'mock' | 'payme' | 'click';
export type PaymentStatus = 'pending' | 'paid' | 'failed';

export interface Product {
  id: ProductId;
  /** Minor units (tiyin). 1 so'm = 100 tiyin. */
  amountMinor: number;
  currency: 'UZS';
}

/** TODO(pricing): set the real persona price. Placeholder until decided. */
export const PRODUCTS: Record<ProductId, Product> = {
  persona_slot: {
    id: 'persona_slot',
    amountMinor: Number(process.env.PERSONA_PRICE_MINOR ?? 0),
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
  createdAt: string;
  updatedAt: string;
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
  payments: Record<string, Payment>;
  entitlements: Record<string, Entitlement>;
  receipts: Record<string, Receipt>;
  processedEvents: Record<string, ProcessedEvent>;
  saves: Record<string, SaveRecord>;
  /** key: `${userId}:${matchId}` → highlighted event ids */
  highlights: Record<string, string[]>;
}

export const emptyDb = (): DbShape => ({
  payments: {},
  entitlements: {},
  receipts: {},
  processedEvents: {},
  saves: {},
  highlights: {},
});

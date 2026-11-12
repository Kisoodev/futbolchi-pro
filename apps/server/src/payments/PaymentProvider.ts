/**
 * Payment provider abstraction. The MVP ships only MockPaymentProvider.
 *
 * TODO(payme): implement PaymeProvider (Merchant API: JSON-RPC callbacks
 *   CheckPerformTransaction / CreateTransaction / PerformTransaction, Basic auth).
 * TODO(click): implement ClickProvider (Prepare/Complete callbacks, MD5 sign_string).
 * Both must map their callbacks onto ProviderWebhookEvent so PaymentService
 * stays provider-agnostic.
 */
import type { PaymentStatus, ProductId, ProviderName } from '../domain';

export interface CreatePaymentInput {
  /** Our internal payment id (also used as the provider's order/merchant reference). */
  paymentId: string;
  userId: string;
  product: ProductId;
  amountMinor: number;
  currency: 'UZS';
}

export interface CreatePaymentResult {
  providerPaymentId: string;
  /** Where the client should send the user to pay. */
  checkoutUrl: string;
}

export type ProviderEventType = 'payment.succeeded' | 'payment.failed';

/** Normalized webhook event. */
export interface ProviderWebhookEvent {
  /** Unique per delivery-independent event; retries of the same event reuse it. */
  eventId: string;
  type: ProviderEventType;
  providerPaymentId: string;
  amountMinor: number;
  providerTxnId: string;
}

export type WebhookHeaders = Record<string, string | string[] | undefined>;

export interface PaymentProvider {
  readonly name: ProviderName;
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;
  /** Verifies authenticity (signature) and normalizes. Throws InvalidWebhookError if not genuine. */
  parseWebhook(rawBody: string, headers: WebhookHeaders): Promise<ProviderWebhookEvent>;
  /** Asks the provider directly; used to reconcile when a webhook is late or lost. */
  getStatus(providerPaymentId: string): Promise<{ status: PaymentStatus; providerTxnId?: string }>;
}

export class InvalidWebhookError extends Error {}

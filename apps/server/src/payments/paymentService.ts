/**
 * Provider-agnostic payment logic.
 *
 * Idempotency is enforced at three levels:
 *  1. Event level: each (provider, eventId) is processed at most once.
 *  2. Payment level: entitlement and receipt ids are derived from paymentId,
 *     so even two *different* success events for one payment grant once.
 *  3. State machine: a payment only moves pending → paid | failed.
 * Activation is immediate: the entitlement is written in the same
 * synchronous transaction that marks the payment paid.
 */
import { randomUUID } from 'node:crypto';
import {
  PRODUCTS,
  type DbShape,
  type Entitlement,
  type Payment,
  type PaymentStatus,
  type ProductId,
  type Receipt,
  type WebhookOutcome,
} from '../domain';
import type { JsonStore } from '../store/jsonStore';
import type { PaymentProvider, WebhookHeaders } from './PaymentProvider';

export interface WebhookResult {
  outcome: WebhookOutcome | 'duplicate';
  paymentId: string | null;
}

const now = () => new Date().toISOString();
export const entitlementIdFor = (paymentId: string) => `ent_${paymentId}`;
export const receiptIdFor = (paymentId: string) => `rcpt_${paymentId}`;

export class PaymentService {
  constructor(
    private readonly store: JsonStore,
    private readonly provider: PaymentProvider,
  ) {}

  async createPayment(userId: string, productId: ProductId): Promise<{ payment: Payment; checkoutUrl: string }> {
    const product = PRODUCTS[productId];
    if (!product) throw new Error('unknown product');
    // One open payment per user and product: returning to the pay page must not pile up payments.
    const open = this.store.read((db) =>
      Object.values(db.payments).find(
        (p) => p.userId === userId && p.product === productId && p.provider === this.provider.name && p.status === 'pending',
      ),
    );
    if (open) return { payment: open, checkoutUrl: open.checkoutUrl ?? '' };
    const id = `pay_${randomUUID()}`;
    const res = await this.provider.createPayment({
      paymentId: id,
      userId,
      product: productId,
      amountMinor: product.amountMinor,
      currency: product.currency,
    });
    const payment: Payment = {
      id,
      userId,
      product: productId,
      amountMinor: product.amountMinor,
      currency: product.currency,
      provider: this.provider.name,
      providerPaymentId: res.providerPaymentId,
      status: 'pending',
      checkoutUrl: res.checkoutUrl,
      createdAt: now(),
      updatedAt: now(),
    };
    this.store.transaction((db) => {
      db.payments[id] = payment;
    });
    return { payment, checkoutUrl: res.checkoutUrl };
  }

  /** Throws InvalidWebhookError for unauthentic requests (caller should answer 400/401). */
  async handleWebhook(rawBody: string, headers: WebhookHeaders): Promise<WebhookResult> {
    const event = await this.provider.parseWebhook(rawBody, headers);
    const key = `${this.provider.name}:${event.eventId}`;

    // Everything below is synchronous → atomic with respect to other requests.
    return this.store.transaction((db): WebhookResult => {
      const seen = db.processedEvents[key];
      if (seen) return { outcome: 'duplicate', paymentId: seen.paymentId };

      const payment = Object.values(db.payments).find(
        (p) => p.provider === this.provider.name && p.providerPaymentId === event.providerPaymentId,
      );
      let outcome: WebhookOutcome;
      if (!payment) outcome = 'unknown_payment';
      else if (event.type === 'payment.failed') {
        if (payment.status === 'pending') {
          payment.status = 'failed';
          payment.updatedAt = now();
          outcome = 'failed';
        } else outcome = 'ignored';
      } else if (event.amountMinor !== payment.amountMinor) {
        outcome = 'amount_mismatch';
      } else {
        outcome = this.grant(db, payment, event.providerTxnId);
      }
      db.processedEvents[key] = { key, paymentId: payment?.id ?? null, result: outcome, receivedAt: now() };
      return { outcome, paymentId: payment?.id ?? null };
    });
  }

  /** Status for the client. If still pending, reconcile with the provider (late/lost webhook). */
  async getStatus(paymentId: string): Promise<PaymentStatus | null> {
    const payment = this.store.read((db) => db.payments[paymentId]);
    if (!payment) return null;
    if (payment.status !== 'pending') return payment.status;
    const remote = await this.provider.getStatus(payment.providerPaymentId);
    if (remote.status === 'paid' && remote.providerTxnId) {
      this.store.transaction((db) => this.grant(db, db.payments[paymentId], remote.providerTxnId!));
    }
    return this.store.read((db) => db.payments[paymentId].status);
  }

  /** Marks paid + writes entitlement + receipt. Idempotent per payment. Must run inside a transaction. */
  private grant(db: DbShape, payment: Payment, providerTxnId: string): WebhookOutcome {
    const entId = entitlementIdFor(payment.id);
    if (db.entitlements[entId]) return 'already_granted';
    if (payment.status === 'failed') return 'ignored';
    payment.status = 'paid';
    payment.updatedAt = now();
    const entitlement: Entitlement = {
      id: entId,
      userId: payment.userId,
      product: payment.product,
      paymentId: payment.id,
      grantedAt: now(),
      consumedByPersonaId: null,
    };
    const receipt: Receipt = {
      id: receiptIdFor(payment.id),
      paymentId: payment.id,
      userId: payment.userId,
      product: payment.product,
      amountMinor: payment.amountMinor,
      currency: payment.currency,
      provider: payment.provider,
      providerTxnId,
      createdAt: now(),
    };
    db.entitlements[entId] = entitlement;
    db.receipts[receipt.id] = receipt;
    return 'granted';
  }

  /**
   * Free access granted by an admin (no payment). It still leaves a Payment and
   * a 0-amount Receipt so every grant is auditable. If the user already has an
   * unused slot, that one is returned instead of creating another.
   */
  adminGrant(userId: string, productId: ProductId): Entitlement {
    return this.store.transaction((db) => {
      const unused = Object.values(db.entitlements).find(
        (e) => e.userId === userId && e.product === productId && e.consumedByPersonaId === null,
      );
      if (unused) return unused;
      const id = `pay_${randomUUID()}`;
      const payment: Payment = {
        id,
        userId,
        product: productId,
        amountMinor: 0,
        currency: 'UZS',
        provider: 'admin',
        providerPaymentId: `admin_${id}`,
        status: 'pending',
        checkoutUrl: '',
        createdAt: now(),
        updatedAt: now(),
      };
      db.payments[id] = payment;
      this.grant(db, payment, `admingrant_${id}`);
      return db.entitlements[entitlementIdFor(id)];
    });
  }

  entitlements(userId: string): Entitlement[] {
    return this.store.read((db) => Object.values(db.entitlements).filter((e) => e.userId === userId));
  }

  receipts(userId: string): Receipt[] {
    return this.store.read((db) => Object.values(db.receipts).filter((r) => r.userId === userId));
  }

  /** Spend a persona slot. Idempotent for the same personaId. */
  consume(entitlementId: string, userId: string, personaId: string): { ok: true; entitlement: Entitlement } | { ok: false; code: 404 | 409 } {
    return this.store.transaction((db) => {
      const e = db.entitlements[entitlementId];
      if (!e || e.userId !== userId) return { ok: false as const, code: 404 as const };
      if (e.consumedByPersonaId && e.consumedByPersonaId !== personaId) return { ok: false as const, code: 409 as const };
      e.consumedByPersonaId = personaId;
      return { ok: true as const, entitlement: e };
    });
  }
}

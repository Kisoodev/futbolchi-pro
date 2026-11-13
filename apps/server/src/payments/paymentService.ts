/**
 * Provider-agnostic payment logic.
 *
 * Idempotency is enforced at three levels:
 *  1. Event level: each (provider, eventId) is processed at most once
 *     (insert-if-absent on processed events).
 *  2. Payment level: entitlement and receipt ids are derived from paymentId,
 *     so even two *different* success events for one payment grant once.
 *  3. State machine: a payment only moves pending → paid | failed
 *     (update-if-pending).
 * All three are atomic in the Db, so this also holds on Postgres with
 * concurrent requests. Activation is immediate: the entitlement is written
 * right after the payment is marked paid.
 */
import type { Db } from '../db';
import {
  productsFor,
  type Entitlement,
  type Payment,
  type PaymentStatus,
  type Product,
  type ProductId,
  type Receipt,
  type WebhookOutcome,
} from '../domain';
import type { PaymentProvider, WebhookHeaders } from './PaymentProvider';

export interface WebhookResult {
  outcome: WebhookOutcome | 'duplicate';
  paymentId: string | null;
}

const now = () => new Date().toISOString();
export const entitlementIdFor = (paymentId: string) => `ent_${paymentId}`;
export const receiptIdFor = (paymentId: string) => `rcpt_${paymentId}`;

export class PaymentService {
  readonly products: Record<ProductId, Product>;

  constructor(
    private readonly db: Db,
    private readonly provider: PaymentProvider,
    priceMinor?: number,
  ) {
    this.products = productsFor(priceMinor);
  }

  async createPayment(userId: string, productId: ProductId): Promise<{ payment: Payment; checkoutUrl: string }> {
    const product = this.products[productId];
    if (!product) throw new Error('unknown product');
    // One open payment per user and product: returning to the pay page must not pile up payments.
    const open = await this.db.findOpenPayment(userId, productId, this.provider.name);
    if (open) return { payment: open, checkoutUrl: open.checkoutUrl ?? '' };
    const id = `pay_${crypto.randomUUID()}`;
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
    await this.db.insertPayment(payment);
    return { payment, checkoutUrl: res.checkoutUrl };
  }

  /** Throws InvalidWebhookError for unauthentic requests (caller should answer 400/401). */
  async handleWebhook(rawBody: string, headers: WebhookHeaders): Promise<WebhookResult> {
    const event = await this.provider.parseWebhook(rawBody, headers);
    const key = `${this.provider.name}:${event.eventId}`;
    const payment = await this.db.findPaymentByProvider(this.provider.name, event.providerPaymentId);

    // Claim the event first: only one delivery of it is ever processed.
    const first = await this.db.insertProcessedEvent({ key, paymentId: payment?.id ?? null, result: 'ignored', receivedAt: now() });
    if (!first) return { outcome: 'duplicate', paymentId: payment?.id ?? null };

    let outcome: WebhookOutcome;
    if (!payment) outcome = 'unknown_payment';
    else if (event.type === 'payment.failed') outcome = (await this.db.settlePayment(payment.id, 'failed', now())) ? 'failed' : 'ignored';
    else if (event.amountMinor !== payment.amountMinor) outcome = 'amount_mismatch';
    else outcome = await this.grant(payment, event.providerTxnId);

    await this.db.setProcessedEventResult(key, outcome, payment?.id ?? null);
    return { outcome, paymentId: payment?.id ?? null };
  }

  /** Status for the client. If still pending, reconcile with the provider (late/lost webhook). */
  async getStatus(paymentId: string): Promise<PaymentStatus | null> {
    const payment = await this.db.getPayment(paymentId);
    if (!payment) return null;
    if (payment.status !== 'pending') return payment.status;
    const remote = await this.provider.getStatus(payment.providerPaymentId);
    if (remote.status === 'paid' && remote.providerTxnId) await this.grant(payment, remote.providerTxnId);
    return (await this.db.getPayment(paymentId))?.status ?? null;
  }

  /** Marks paid + writes entitlement + receipt. Idempotent per payment; a failed payment is never granted. */
  private async grant(payment: Payment, providerTxnId: string): Promise<WebhookOutcome> {
    const settled = await this.db.settlePayment(payment.id, 'paid', now());
    if (!settled && (await this.db.getPayment(payment.id))?.status !== 'paid') return 'ignored';
    const entitlement: Entitlement = {
      id: entitlementIdFor(payment.id),
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
    const granted = await this.db.insertEntitlement(entitlement);
    // Always attempted: also repairs a receipt lost between the two writes.
    await this.db.insertReceipt(receipt);
    return granted ? 'granted' : 'already_granted';
  }

  /**
   * Free access granted by an admin (no payment). It still leaves a Payment and
   * a 0-amount Receipt so every grant is auditable. If the user already has an
   * unused slot, that one is returned instead of creating another.
   */
  async adminGrant(userId: string, productId: ProductId): Promise<Entitlement> {
    const unused = (await this.db.listEntitlements(userId)).find((e) => e.product === productId && e.consumedByPersonaId === null);
    if (unused) return unused;
    const id = `pay_${crypto.randomUUID()}`;
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
    await this.db.insertPayment(payment);
    await this.grant(payment, `admingrant_${id}`);
    const ent = await this.db.getEntitlement(entitlementIdFor(id));
    if (!ent) throw new Error('admin grant failed');
    return ent;
  }

  entitlements(userId: string): Promise<Entitlement[]> {
    return this.db.listEntitlements(userId);
  }

  receipts(userId: string): Promise<Receipt[]> {
    return this.db.listReceipts(userId);
  }

  /** Spend a persona slot. Idempotent for the same personaId. */
  async consume(
    entitlementId: string,
    userId: string,
    personaId: string,
  ): Promise<{ ok: true; entitlement: Entitlement } | { ok: false; code: 404 | 409 }> {
    const e = await this.db.getEntitlement(entitlementId);
    if (!e || e.userId !== userId) return { ok: false, code: 404 };
    const used = await this.db.consumeEntitlement(entitlementId, userId, personaId);
    return used ? { ok: true, entitlement: used } : { ok: false, code: 409 };
  }
}

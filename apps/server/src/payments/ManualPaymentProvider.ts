/**
 * Manual provider: the player transfers money to a card, uploads a receipt
 * ("chek"), and an admin approves or rejects it. No external service.
 *
 * The admin decision is turned into a signed ProviderWebhookEvent and sent
 * through the same PaymentService.handleWebhook path as any real provider, so
 * idempotency, immediate activation and receipts work identically.
 * The event id is derived from the payment and the decision, so approving the
 * same payment twice is a duplicate event by construction.
 *
 * TODO(payme/click): replace with real providers when automatic payments are needed.
 */
import type { PaymentStatus } from '../domain';
import type { CreatePaymentInput, CreatePaymentResult, PaymentProvider, ProviderWebhookEvent, WebhookHeaders } from './PaymentProvider';
import { signBody, verifySignedEvent } from './signedEvents';

export const MANUAL_SIGNATURE_HEADER = 'x-manual-signature';

export class ManualPaymentProvider implements PaymentProvider {
  readonly name = 'manual' as const;

  constructor(private readonly secret: string) {}

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    return { providerPaymentId: `manual_${input.paymentId}`, checkoutUrl: '/#/pay' };
  }

  /** There is no remote system to ask: our own records are the truth until an admin decides. */
  async getStatus(): Promise<{ status: PaymentStatus }> {
    return { status: 'pending' };
  }

  async parseWebhook(rawBody: string, headers: WebhookHeaders): Promise<ProviderWebhookEvent> {
    return verifySignedEvent(this.secret, MANUAL_SIGNATURE_HEADER, rawBody, headers);
  }

  /** Builds the signed event for an admin decision. */
  async decisionWebhook(
    payment: { providerPaymentId: string; amountMinor: number },
    decision: 'approve' | 'reject',
  ): Promise<{ rawBody: string; headers: Record<string, string> }> {
    const event: ProviderWebhookEvent = {
      eventId: `manual_${decision}_${payment.providerPaymentId}`,
      type: decision === 'approve' ? 'payment.succeeded' : 'payment.failed',
      providerPaymentId: payment.providerPaymentId,
      amountMinor: payment.amountMinor,
      providerTxnId: `manualtxn_${payment.providerPaymentId}`,
    };
    const rawBody = JSON.stringify(event);
    return { rawBody, headers: { 'content-type': 'application/json', [MANUAL_SIGNATURE_HEADER]: await signBody(this.secret, rawBody) } };
  }
}

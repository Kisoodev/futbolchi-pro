/**
 * Mock provider for the MVP. No money moves. Webhooks are HMAC-signed so the
 * verification path is exercised exactly like a real provider's would be.
 */
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import type { PaymentStatus } from '../domain';
import {
  InvalidWebhookError,
  type CreatePaymentInput,
  type CreatePaymentResult,
  type PaymentProvider,
  type ProviderWebhookEvent,
  type WebhookHeaders,
} from './PaymentProvider';

export const MOCK_SIGNATURE_HEADER = 'x-mock-signature';

interface MockPayment {
  amountMinor: number;
  status: PaymentStatus;
  txnId?: string;
}

export class MockPaymentProvider implements PaymentProvider {
  readonly name = 'mock' as const;
  private readonly payments = new Map<string, MockPayment>();

  constructor(private readonly secret: string) {}

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    const providerPaymentId = `mock_${input.paymentId}`;
    this.payments.set(providerPaymentId, { amountMinor: input.amountMinor, status: 'pending' });
    return { providerPaymentId, checkoutUrl: `/mock-checkout/${input.paymentId}` };
  }

  async getStatus(providerPaymentId: string) {
    const p = this.payments.get(providerPaymentId);
    return { status: p?.status ?? ('failed' as PaymentStatus), providerTxnId: p?.txnId };
  }

  sign(rawBody: string): string {
    return createHmac('sha256', this.secret).update(rawBody).digest('hex');
  }

  async parseWebhook(rawBody: string, headers: WebhookHeaders): Promise<ProviderWebhookEvent> {
    const sig = headers[MOCK_SIGNATURE_HEADER];
    if (typeof sig !== 'string') throw new InvalidWebhookError('missing signature');
    const expected = Buffer.from(this.sign(rawBody), 'hex');
    const given = Buffer.from(sig, 'hex');
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
      throw new InvalidWebhookError('bad signature');
    }
    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      throw new InvalidWebhookError('bad json');
    }
    const e = body as Partial<ProviderWebhookEvent>;
    if (
      typeof e.eventId !== 'string' ||
      (e.type !== 'payment.succeeded' && e.type !== 'payment.failed') ||
      typeof e.providerPaymentId !== 'string' ||
      typeof e.amountMinor !== 'number' ||
      typeof e.providerTxnId !== 'string'
    ) {
      throw new InvalidWebhookError('bad payload');
    }
    return e as ProviderWebhookEvent;
  }

  /**
   * Dev/test helper: the user "completes" checkout. Returns the signed webhook
   * the provider would deliver to us.
   */
  simulateCheckout(providerPaymentId: string, outcome: 'success' | 'fail'): { rawBody: string; headers: Record<string, string> } {
    const p = this.payments.get(providerPaymentId);
    if (!p) throw new Error('unknown mock payment');
    if (p.status === 'pending') {
      p.status = outcome === 'success' ? 'paid' : 'failed';
      p.txnId = `mocktxn_${randomUUID()}`;
    }
    const event: ProviderWebhookEvent = {
      eventId: `evt_${randomUUID()}`,
      type: p.status === 'paid' ? 'payment.succeeded' : 'payment.failed',
      providerPaymentId,
      amountMinor: p.amountMinor,
      providerTxnId: p.txnId!,
    };
    const rawBody = JSON.stringify(event);
    return { rawBody, headers: { 'content-type': 'application/json', [MOCK_SIGNATURE_HEADER]: this.sign(rawBody) } };
  }
}

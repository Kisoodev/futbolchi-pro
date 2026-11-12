/** HMAC-signed provider events, shared by the mock and manual providers. */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { InvalidWebhookError, type ProviderWebhookEvent, type WebhookHeaders } from './PaymentProvider';

export const signBody = (secret: string, rawBody: string): string =>
  createHmac('sha256', secret).update(rawBody).digest('hex');

export function verifySignedEvent(secret: string, headerName: string, rawBody: string, headers: WebhookHeaders): ProviderWebhookEvent {
  const sig = headers[headerName];
  if (typeof sig !== 'string') throw new InvalidWebhookError('missing signature');
  const expected = Buffer.from(signBody(secret, rawBody), 'hex');
  const given = Buffer.from(sig, 'hex');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) throw new InvalidWebhookError('bad signature');
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

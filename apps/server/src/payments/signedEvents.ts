/**
 * HMAC-signed provider events, shared by the mock and manual providers.
 * Uses WebCrypto, so it runs in Node and in the Supabase Edge Function (Deno).
 */
import { InvalidWebhookError, type ProviderWebhookEvent, type WebhookHeaders } from './PaymentProvider';

const enc = new TextEncoder();
const toHex = (buf: ArrayBuffer) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');

export async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return toHex(await crypto.subtle.sign('HMAC', key, enc.encode(message)));
}

export const signBody = (secret: string, rawBody: string): Promise<string> => hmacHex(secret, rawBody);

/** Constant-time comparison of two hex strings. */
const sameHex = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

export async function verifySignedEvent(
  secret: string,
  headerName: string,
  rawBody: string,
  headers: WebhookHeaders,
): Promise<ProviderWebhookEvent> {
  const sig = headers[headerName];
  if (typeof sig !== 'string') throw new InvalidWebhookError('missing signature');
  if (!sameHex(sig.toLowerCase(), await signBody(secret, rawBody))) throw new InvalidWebhookError('bad signature');
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

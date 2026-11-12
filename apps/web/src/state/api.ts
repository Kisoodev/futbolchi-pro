/** Thin client for the MVP server (payments, saves). Vite proxies /api to the server. */
import type { GameState } from '@futbolchi/engine';

async function call<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body !== undefined ? { 'content-type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${url} → ${res.status}`);
  return (await res.json()) as T;
}

export interface CreatedPayment {
  paymentId: string;
  checkoutUrl: string;
  amountMinor: number;
  currency: 'UZS';
}
export type PaymentStatus = 'pending' | 'paid' | 'failed';
export interface Entitlement {
  id: string;
  paymentId: string;
  product: string;
  consumedByPersonaId: string | null;
}
export interface Receipt {
  id: string;
  paymentId: string;
  amountMinor: number;
  currency: 'UZS';
  createdAt: string;
}

export const api = {
  product: () => call<{ product: string; amountMinor: number; currency: 'UZS' }>('GET', '/api/products/persona_slot'),
  createPayment: (userId: string) => call<CreatedPayment>('POST', '/api/payments', { userId, product: 'persona_slot' }),
  paymentStatus: (paymentId: string) => call<{ status: PaymentStatus }>('GET', `/api/payments/${paymentId}`),
  /** Mock checkout only: asks the mock provider to send its webhook. TODO(payme/click): real checkout redirects instead. */
  mockPay: (paymentId: string, outcome: 'success' | 'fail') =>
    call<{ ok: true }>('POST', `/api/mock-checkout/${paymentId}`, { outcome }),
  entitlements: (userId: string) => call<{ entitlements: Entitlement[] }>('GET', `/api/entitlements?userId=${encodeURIComponent(userId)}`),
  consume: (entitlementId: string, userId: string, personaId: string) =>
    call<{ entitlement: Entitlement }>('POST', `/api/entitlements/${entitlementId}/consume`, { userId, personaId }),
  receipts: (userId: string) => call<{ receipts: Receipt[] }>('GET', `/api/receipts?userId=${encodeURIComponent(userId)}`),
  /** Best-effort save sync so the admin tool can see match events. */
  syncSave: (userId: string, state: GameState) => call<{ ok: true }>('PUT', `/api/saves/${userId}`, state).catch(() => null),
};

export const formatUzs = (minor: number): string =>
  `${new Intl.NumberFormat('uz-UZ').format(Math.round(minor / 100))} so'm`;

/**
 * Thin client for the server (registration, payments, saves).
 * Dev: Vite proxies /api to the local server. Production: the game is served
 * by Vercel and the API lives elsewhere, set at build time with VITE_API_URL
 * (e.g. https://futbolchi-api.up.railway.app).
 */
import type { GameState } from '@futbolchi/engine';

export const API_BASE = (import.meta.env.VITE_API_URL ?? '').trim().replace(/\/+$/, '');
/** Full address of an API path such as "/api/stats". */
export const apiUrl = (path: string) => API_BASE + path;

async function call<T>(method: string, url: string, body?: unknown, headers: Record<string, string> = {}): Promise<T> {
  const res = await fetch(apiUrl(url), {
    method,
    headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new ApiError(res.status, `${method} ${url} → ${res.status}`);
  return (await res.json()) as T;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export type PaymentStatus = 'pending' | 'paid' | 'failed';
export type ProofStatus = 'submitted' | 'approved' | 'rejected';
/** Why the admin rejected a receipt (same codes as the server). */
export type RejectReason = 'amount' | 'unreadable' | 'not_received' | 'duplicate';

export interface AppConfig {
  provider: string;
  product: { id: string; amountMinor: number; currency: 'UZS' };
  card: { number: string; holder: string } | null;
  /** Link to message the admin (Telegram). */
  contact: string | null;
}
export interface CreatedPayment {
  paymentId: string;
  checkoutUrl: string;
  amountMinor: number;
  currency: 'UZS';
}
export interface PaymentState {
  status: PaymentStatus;
  proof: ProofStatus | null;
  note: string | null;
  reason: RejectReason | null;
}
export interface Entitlement {
  id: string;
  paymentId: string;
  product: string;
  consumedByPersonaId: string | null;
}

const q = encodeURIComponent;

export const api = {
  stats: () => call<{ registered: number }>('GET', '/api/stats'),
  config: () => call<AppConfig>('GET', '/api/config'),
  register: (userId: string, name: string) => call<{ user?: { id: string; name: string }; admin?: true }>('POST', '/api/users', { userId, name }),
  createPayment: (userId: string) => call<CreatedPayment>('POST', '/api/payments', { userId, product: 'persona_slot' }),
  paymentState: (paymentId: string) => call<PaymentState>('GET', `/api/payments/${paymentId}`),
  uploadProof: (paymentId: string, userId: string, dataUrl: string) =>
    call<{ ok: true }>('POST', `/api/payments/${paymentId}/proof`, { userId, dataUrl }),
  entitlements: (userId: string) => call<{ entitlements: Entitlement[] }>('GET', `/api/entitlements?userId=${q(userId)}`),
  consume: (entitlementId: string, userId: string, personaId: string) =>
    call<{ entitlement: Entitlement }>('POST', `/api/entitlements/${entitlementId}/consume`, { userId, personaId }),
  /** Best-effort save sync so the admin tool can see match events. */
  syncSave: (userId: string, state: GameState) => call<{ ok: true }>('PUT', `/api/saves/${userId}`, state).catch(() => null),
};

// ---------- Admin ----------
export interface AdminPayment {
  paymentId: string;
  userId: string;
  userName: string | null;
  amountMinor: number;
  provider: string;
  status: PaymentStatus;
  createdAt: string;
  proof: { status: ProofStatus; uploadedAt: string } | null;
}

export const adminApi = (token: string) => {
  const h = { 'x-admin-token': token };
  return {
    ping: () => call<{ ok: true }>('GET', '/api/admin/ping', undefined, h),
    payments: () => call<{ payments: AdminPayment[] }>('GET', '/api/admin/payments', undefined, h),
    decide: (paymentId: string, decision: 'approve' | 'reject', note?: string) =>
      call<{ outcome: string; status: PaymentStatus }>('POST', `/api/admin/payments/${paymentId}/decision`, { decision, note }, h),
    grant: (userId: string) => call<{ entitlement: Entitlement }>('POST', '/api/admin/grant', { userId }, h),
    /** Receipt image as an object URL (the endpoint needs the token header, so <img src> can't load it directly). */
    proofUrl: async (paymentId: string): Promise<string> => {
      const res = await fetch(apiUrl(`/api/admin/payments/${paymentId}/proof`), { headers: h });
      if (!res.ok) throw new ApiError(res.status, 'proof');
      return URL.createObjectURL(await res.blob());
    },
    headers: h,
  };
};

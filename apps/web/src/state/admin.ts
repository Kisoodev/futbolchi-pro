/**
 * Owner ("admin") mode in this browser. After one successful login the admin
 * token is remembered here, so the owner can skip the payment page and open the
 * admin panel without typing the token again. The token is checked by the
 * server on every admin request, so a value someone types into localStorage by
 * hand gives no access.
 */
import { adminApi } from './api';

const KEY = 'futbolchi.adminToken';

export function getAdminToken(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setAdminToken(token: string): void {
  try {
    localStorage.setItem(KEY, token);
  } catch {
    /* storage blocked: admin mode lasts for this page only */
  }
}

export function clearAdminToken(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** The remembered token if the server still accepts it; otherwise null (and it is forgotten on 401). */
export async function verifiedAdminToken(): Promise<string | null> {
  const token = getAdminToken();
  if (!token) return null;
  try {
    await adminApi(token).ping();
    return token;
  } catch (e) {
    if (e instanceof Error && 'status' in e && (e as { status: number }).status === 401) clearAdminToken();
    return null;
  }
}

export const openAdmin = () => {
  location.hash = '#/admin';
};

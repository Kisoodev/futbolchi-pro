/**
 * Local persistence. The game state is plain JSON stored in localStorage.
 * Every access is wrapped: storage may be unavailable (private mode, blocked).
 */
import type { GameState } from '@futbolchi/engine';

const SAVE_KEY = 'futbolchi.save.v1';
const USER_KEY = 'futbolchi.userId';
const ENTITLEMENT_KEY = 'futbolchi.entitlementId';

export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as GameState;
    return s.version === 1 ? s : null;
  } catch {
    return null;
  }
}

export function saveGame(state: GameState): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch {
    /* storage full or blocked: game continues in memory */
  }
}

export function clearGame(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* ignore */
  }
}

let memoryUserId: string | null = null;
/** Anonymous user id (no account system in MVP). */
export function getUserId(): string {
  try {
    let id = localStorage.getItem(USER_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(USER_KEY, id);
    }
    return id;
  } catch {
    memoryUserId ??= crypto.randomUUID();
    return memoryUserId;
  }
}

export function rememberEntitlement(id: string | null): void {
  try {
    if (id) localStorage.setItem(ENTITLEMENT_KEY, id);
    else localStorage.removeItem(ENTITLEMENT_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Local persistence. The game state is plain JSON stored in localStorage.
 * Every access is wrapped: storage may be unavailable (private mode, blocked).
 */
import { constants as C, type GameState } from '@futbolchi/engine';

const SAVE_KEY = 'futbolchi.save.v1';
const USER_KEY = 'futbolchi.userId';
const NAME_KEY = 'futbolchi.userName';

export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as GameState;
    if (s.version !== 1) return null;
    // Saves made before appearance existed.
    if (!s.persona.appearance) s.persona.appearance = { ...C.DEFAULT_APPEARANCE };
    return s;
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

let memoryName = '';
/** The name entered on the main menu. */
export function getUserName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? memoryName;
  } catch {
    return memoryName;
  }
}

export function setUserName(name: string): void {
  memoryName = name;
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    /* ignore */
  }
}

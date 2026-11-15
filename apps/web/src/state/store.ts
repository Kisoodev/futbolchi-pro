/**
 * Local persistence. The game state is plain JSON stored in localStorage.
 * Every access is wrapped: storage may be unavailable (private mode, blocked).
 */
import { migrateGame, normalizeAppearance, type GameState } from '@futbolchi/engine';

const SAVE_KEY = 'futbolchi.save.v1';
const USER_KEY = 'futbolchi.userId';
const NAME_KEY = 'futbolchi.userName';

export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GameState;
    if (parsed.version !== 1 && parsed.version !== 2) return null;
    // Saves made before the progression system (v1) move to the new scale.
    const s = migrateGame(parsed);
    // Saves made before appearance (or some of its options) existed.
    s.persona.appearance = normalizeAppearance(s.persona.appearance);
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

const INTRO_KEY = 'futbolchi.introSeen';

/** Whether the opening film was already shown for this persona (shown once per persona). */
export function introSeen(personaId: string): boolean {
  try {
    return (localStorage.getItem(INTRO_KEY) ?? '').split(',').includes(personaId);
  } catch {
    return true;
  }
}

export function markIntroSeen(personaId: string): void {
  try {
    const ids = (localStorage.getItem(INTRO_KEY) ?? '').split(',').filter(Boolean);
    if (!ids.includes(personaId)) localStorage.setItem(INTRO_KEY, [...ids, personaId].slice(-20).join(','));
  } catch {
    /* storage blocked: the film may show again next time */
  }
}

const PENDING_KEY = 'futbolchi.pending';

/**
 * A new career that is created and has watched its intro but is not paid
 * yet. It is kept apart from the main save, so the current career stays
 * playable until the payment goes through.
 */
export function loadPending(): GameState | null {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as GameState;
    return s.version === 2 ? s : null;
  } catch {
    return null;
  }
}

export function savePending(state: GameState): void {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(state));
  } catch {
    /* storage full or blocked: the flow continues in memory */
  }
}

export function clearPending(): void {
  try {
    localStorage.removeItem(PENDING_KEY);
  } catch {
    /* ignore */
  }
}

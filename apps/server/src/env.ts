/**
 * Loads server settings from apps/server/.env (git-ignored) before anything
 * else reads process.env. Works the same in PowerShell, cmd and bash.
 * Variables already set in the shell win over the file.
 * Import this first in main.ts: other modules read env at import time.
 */
import { existsSync, utimesSync, watchFile } from 'node:fs';
import { fileURLToPath } from 'node:url';

const file = fileURLToPath(new URL('../.env', import.meta.url));
if (existsSync(file)) {
  process.loadEnvFile(file);
  console.log('[env] loaded apps/server/.env');
}

/** An empty line like `ADMIN_TOKEN=` means "not set", so the defaults apply. */
const KEYS = ['ADMIN_TOKEN', 'ADMIN_NICK', 'PAYMENT_CARD_NUMBER', 'PAYMENT_CARD_HOLDER', 'PERSONA_PRICE_MINOR', 'PAYMENT_EVENT_SECRET', 'DATA_DIR', 'WEB_URL', 'PORT', 'ADMIN_CONTACT_URL', 'TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID'];
for (const key of KEYS) {
  if (process.env[key]?.trim() === '') delete process.env[key];
}

/**
 * Dev: restart when .env changes. tsx watch does not see .env (it is not
 * imported), so touching this file makes tsx restart the server.
 */
if (process.env.NODE_ENV !== 'production') {
  const self = fileURLToPath(import.meta.url);
  watchFile(file, { interval: 1000 }, (cur, prev) => {
    if (cur.mtimeMs === prev.mtimeMs) return;
    console.log('[env] .env changed — restarting');
    const now = new Date();
    utimesSync(self, now, now);
  }).unref();
}

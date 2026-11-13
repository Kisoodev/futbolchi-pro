/**
 * Local server (Node): `npm run dev`. Data lives in apps/server/data
 * (db.json + receipt images). Production runs the same API as a Supabase
 * Edge Function instead (supabase.ts).
 */
import './env';
import { fileURLToPath } from 'node:url';
import { serve } from '@hono/node-server';
import { buildApp, type Logger } from './app';
import { DEFAULT_PRICE_MINOR } from './domain';
import { ManualPaymentProvider } from './payments/ManualPaymentProvider';
import { JsonStore } from './store/jsonStore';
import { DiskProofStorage } from './store/proofStorage';
import { StoreDb } from './store/storeDb';
import { TelegramHttp } from './notify/telegram';

const PORT = Number(process.env.PORT ?? 8787);
// Production hosts (Docker, VPS) need the server reachable from outside.
const HOST = process.env.HOST ?? (process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1');
const isProd = process.env.NODE_ENV === 'production';
const dataDir = process.env.DATA_DIR ?? fileURLToPath(new URL('../data', import.meta.url));

const adminToken = process.env.ADMIN_TOKEN ?? (isProd ? null : 'dev-admin-token');
if (!process.env.ADMIN_TOKEN && !isProd) console.warn('[admin] using dev token "dev-admin-token" — set ADMIN_TOKEN');

// Typing this nickname on the name screen opens the admin login (the token is still required).
const adminNick = process.env.ADMIN_NICK ?? (isProd ? null : 'admin1121');

// Manual payments: card transfer + receipt upload + admin approval.
// TODO(payme/click): choose an automatic provider from env once one exists.
const secret = process.env.PAYMENT_EVENT_SECRET ?? (isProd ? null : 'dev-manual-secret');
if (!secret) throw new Error('PAYMENT_EVENT_SECRET is required in production.');

// The card players transfer to. Set both in the environment; the default is an obvious placeholder.
const paymentCard = {
  number: process.env.PAYMENT_CARD_NUMBER ?? '0000 0000 0000 0000',
  holder: process.env.PAYMENT_CARD_HOLDER ?? 'KARTA EGASI',
};
if (!process.env.PAYMENT_CARD_NUMBER) console.warn('[payments] PAYMENT_CARD_NUMBER is not set — showing a placeholder card');

// In dev the game runs on Vite (port 5173). Set WEB_URL when it lives elsewhere.
const webUrl = process.env.WEB_URL ?? (isProd ? null : 'http://localhost:5173');

// Players who wait too long can message the admin here (shown next to the receipt upload).
const contactUrl = process.env.ADMIN_CONTACT_URL ?? 'https://t.me/futproadmin';

// Optional admin bot (long polling here). Leave TELEGRAM_BOT_TOKEN empty locally while production runs the bot.
const tgToken = process.env.TELEGRAM_BOT_TOKEN;
const telegram = tgToken
  ? { api: new TelegramHttp(tgToken), chatId: process.env.TELEGRAM_CHAT_ID ?? null, adminUrl: webUrl ? `${webUrl}/#/admin` : null }
  : null;

const stamp = () => new Date().toISOString().slice(11, 19);
const logger: Logger = {
  info: (m) => console.log(`${stamp()} ${m}`),
  warn: (m) => console.warn(`${stamp()} ${m}`),
  error: (m) => console.error(`${stamp()} ${m}`),
};

const { app, bot } = buildApp({
  db: new StoreDb(new JsonStore(`${dataDir}/db.json`), new DiskProofStorage(`${dataDir}/proofs`)),
  provider: new ManualPaymentProvider(secret),
  priceMinor: Number(process.env.PERSONA_PRICE_MINOR ?? DEFAULT_PRICE_MINOR),
  adminToken,
  adminNick,
  paymentCard,
  contactUrl,
  telegram,
  webUrl,
  // The game page calls this API from the browser.
  corsOrigins: [webUrl, ...(process.env.CORS_ORIGINS ?? '').split(',')].filter((o): o is string => !!o && o.trim() !== ''),
  logger,
});

serve({ fetch: app.fetch, port: PORT, hostname: HOST }, (info) => {
  logger.info(`API listening at http://${HOST}:${info.port}`);
  void bot?.start();
});
